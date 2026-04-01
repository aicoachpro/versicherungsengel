import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { validateWebhookRequest } from "@/lib/api-auth";

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

/**
 * Webhook für eingehende Superchat-Nachrichten.
 * Matcht den Kontakt per superchatContactId, Telefon oder E-Mail
 * und legt automatisch eine Aktivität am Lead an.
 */
export async function POST(req: NextRequest) {
  const auth = validateWebhookRequest(req);
  if (!auth.authorized) return auth.response!;

  const body = await req.json();

  // Superchat Webhook-Payload
  const event = body.event || body.type;
  if (event !== "message.received" && event !== "message_received") {
    return NextResponse.json({ skipped: true, reason: "Nur message.received Events" });
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

  // Lead finden: erst per superchatContactId, dann Telefon/E-Mail
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

    // Wenn gefunden per Telefon/E-Mail, superchatContactId speichern
    if (lead && contactId && !lead.superchatContactId) {
      db.update(leads)
        .set({ superchatContactId: contactId, updatedAt: new Date().toISOString() })
        .where(eq(leads.id, lead.id))
        .run();
    }
  }

  if (!lead) {
    return NextResponse.json(
      {
        matched: false,
        reason: "Kein Lead gefunden",
        contact: { contactId, phone: contactPhone, email: contactEmail, name: contactName },
      },
      { status: 200 }
    );
  }

  // Aktivität anlegen
  const kontaktart = (CHANNEL_MAP[channel.toLowerCase()] || "Sonstiges") as "Telefon" | "E-Mail" | "WhatsApp" | "Vor-Ort" | "LinkedIn" | "Sonstiges";
  const activity = db
    .insert(activities)
    .values({
      leadId: lead.id,
      datum: new Date().toISOString(),
      kontaktart,
      notiz: `[Superchat ${channel}] ${text}`,
    })
    .returning()
    .get();

  return NextResponse.json(
    { matched: true, leadId: lead.id, leadName: lead.name, activityId: activity.id },
    { status: 201 }
  );
}
