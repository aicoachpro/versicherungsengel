import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { validateWebhookRequest } from "@/lib/api-auth";
import { getConversationMessages } from "@/lib/superchat";

// Superchat Kanal → Kontaktart-Mapping
const CHANNEL_MAP: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "Telefon",
  email: "E-Mail",
  facebook: "Sonstiges",
  instagram: "Sonstiges",
  telegram: "Sonstiges",
  webchat: "Sonstiges",
};

type Kontaktart = "Telefon" | "E-Mail" | "WhatsApp" | "Vor-Ort" | "LinkedIn" | "Sonstiges";

function mapKontaktart(channel: string): Kontaktart {
  return (CHANNEL_MAP[channel.toLowerCase()] || "Sonstiges") as Kontaktart;
}

function findLeadByContact(
  contactId: string | undefined,
  contactPhone: string | undefined,
  contactEmail: string | undefined,
) {
  let lead = null;

  if (contactId) {
    lead = db
      .select()
      .from(leads)
      .where(eq(leads.superchatContactId, contactId))
      .get();
  }

  if (!lead && (contactPhone || contactEmail)) {
    const conditions = [];
    if (contactPhone) conditions.push(eq(leads.telefon, contactPhone));
    if (contactEmail) conditions.push(eq(leads.email, contactEmail));

    lead = db
      .select()
      .from(leads)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .get();

    if (lead && contactId && !lead.superchatContactId) {
      db.update(leads)
        .set({ superchatContactId: contactId, updatedAt: new Date().toISOString() })
        .where(eq(leads.id, lead.id))
        .run();
    }
  }

  return lead;
}

/**
 * Webhook für eingehende Superchat-Nachrichten und Konversations-Events.
 *
 * Unterstützte Events:
 * - message.received: legt je Nachricht eine Aktivität am Lead an
 * - conversation.closed / conversation.archived: holt den kompletten Chat-Verlauf
 *   und legt eine einzige Aktivität mit der gesamten Historie an
 */
export async function POST(req: NextRequest) {
  const auth = validateWebhookRequest(req);
  if (!auth.authorized) return auth.response!;

  const body = await req.json();
  const event = body.event || body.type;

  // ===== Event: Konversation geschlossen / archiviert =====
  if (event === "conversation.closed" || event === "conversation.archived") {
    const payload = body.data || body.conversation || body;
    const conversationId = payload.conversation_id || payload.id;
    const contactId = payload.contact_id || payload.contact?.id;
    const contactPhone = payload.contact?.phone || payload.phone;
    const contactEmail = payload.contact?.email || payload.email;
    const channel = payload.channel || "whatsapp";

    if (!conversationId) {
      return NextResponse.json({ skipped: true, reason: "Keine conversation_id" });
    }

    const lead = findLeadByContact(contactId, contactPhone, contactEmail);
    if (!lead) {
      return NextResponse.json(
        {
          matched: false,
          reason: "Kein Lead gefunden",
          contact: { contactId, phone: contactPhone, email: contactEmail },
        },
        { status: 200 },
      );
    }

    // Kompletten Chat-Verlauf holen
    let messages: Array<Record<string, unknown>> = [];
    try {
      messages = await getConversationMessages(conversationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Superchat API Fehler: ${message}` },
        { status: 502 },
      );
    }

    // Nachrichten sortieren (alt → neu)
    messages.sort((a, b) => {
      const ta = new Date((a.created_at as string) || (a.timestamp as string) || 0).getTime();
      const tb = new Date((b.created_at as string) || (b.timestamp as string) || 0).getTime();
      return ta - tb;
    });

    // Chat-Verlauf als Text aufbereiten
    const lines: string[] = [
      `[Superchat ${channel}] Chat-Verlauf (${messages.length} Nachrichten)`,
      "",
    ];
    for (const msg of messages) {
      const ts = (msg.created_at as string) || (msg.timestamp as string) || "";
      const dir = (msg.direction as string) || (msg.type as string) || "";
      const from =
        dir === "inbound" || dir === "incoming"
          ? "Lead"
          : dir === "outbound" || dir === "outgoing"
          ? "Wir"
          : "–";
      const content = msg.content as Record<string, unknown> | undefined;
      const text =
        (content?.text as string) ||
        (msg.body as { text?: string } | undefined)?.text ||
        (msg.text as string) ||
        (msg.message as string) ||
        "";
      const time = ts
        ? new Date(ts).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      lines.push(`[${time}] ${from}: ${text || "(leer)"}`);
    }

    const activity = db
      .insert(activities)
      .values({
        leadId: lead.id,
        datum: new Date().toISOString(),
        kontaktart: mapKontaktart(channel),
        notiz: lines.join("\n"),
      })
      .returning()
      .get();

    return NextResponse.json(
      {
        matched: true,
        leadId: lead.id,
        leadName: lead.name,
        activityId: activity.id,
        messageCount: messages.length,
      },
      { status: 201 },
    );
  }

  // ===== Event: Einzelne Nachricht empfangen =====
  if (event !== "message.received" && event !== "message_received") {
    return NextResponse.json({ skipped: true, reason: `Event nicht unterstuetzt: ${event}` });
  }

  const message = body.data || body.message || body;
  const contactId = message.contact_id || message.contactId;
  const contactPhone = message.contact?.phone || message.phone;
  const contactEmail = message.contact?.email || message.email;
  const contactName = message.contact?.name || message.name;
  const channel = message.channel || "whatsapp";
  const text = message.body?.text || message.text || message.content || "";

  if (!text) {
    return NextResponse.json({ skipped: true, reason: "Leere Nachricht" });
  }

  const lead = findLeadByContact(contactId, contactPhone, contactEmail);

  if (!lead) {
    return NextResponse.json(
      {
        matched: false,
        reason: "Kein Lead gefunden",
        contact: { contactId, phone: contactPhone, email: contactEmail, name: contactName },
      },
      { status: 200 },
    );
  }

  const activity = db
    .insert(activities)
    .values({
      leadId: lead.id,
      datum: new Date().toISOString(),
      kontaktart: mapKontaktart(channel),
      notiz: `[Superchat ${channel}] ${text}`,
    })
    .returning()
    .get();

  return NextResponse.json(
    { matched: true, leadId: lead.id, leadName: lead.name, activityId: activity.id },
    { status: 201 },
  );
}
