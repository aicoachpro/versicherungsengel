import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { leads, activities, apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getConversationMessages,
  normalizePhoneForCompare,
  normalizeEmailForCompare,
} from "@/lib/superchat";

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

// HMAC-SHA256-Verifikation gegen X-Superchat-Signature.
// Akzeptiert sowohl "sha256=<hex>" als auch reines hex.
function verifySuperchatSignature(rawBody: string, header: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

type AuthResult = { ok: true; via: "hmac" | "api-key" } | { ok: false; reason: string };

function authenticate(req: NextRequest, rawBody: string): AuthResult {
  // 1. HMAC-Pfad (Superchat nativ)
  const secret = process.env.SUPERCHAT_WEBHOOK_SECRET;
  const sigHeader =
    req.headers.get("x-superchat-signature") ||
    req.headers.get("x-signature");
  if (secret && sigHeader) {
    return verifySuperchatSignature(rawBody, sigHeader, secret)
      ? { ok: true, via: "hmac" }
      : { ok: false, reason: "Ungueltige HMAC-Signatur" };
  }

  // 2. Fallback: x-api-key (n8n-Relay etc.)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const validKey = db.select().from(apiKeys).where(eq(apiKeys.key, apiKey)).get();
    if (!validKey) return { ok: false, reason: "Ungueltiger API-Key" };
    const limit = checkRateLimit(apiKey, 60, 60_000);
    if (!limit.allowed) return { ok: false, reason: "Rate-Limit ueberschritten" };
    return { ok: true, via: "api-key" };
  }

  return {
    ok: false,
    reason: secret
      ? "Weder X-Superchat-Signature noch x-api-key vorhanden"
      : "x-api-key fehlt (SUPERCHAT_WEBHOOK_SECRET nicht gesetzt — HMAC-Pfad inaktiv)",
  };
}

// Lead-Suche per superchat_contact_id, dann normalisiert per Telefon/Email.
function findLeadByContact(
  contactId: string | undefined,
  contactPhone: string | undefined,
  contactEmail: string | undefined,
) {
  if (contactId) {
    const byScid = db
      .select()
      .from(leads)
      .where(eq(leads.superchatContactId, contactId))
      .get();
    if (byScid) return byScid;
  }

  if (!contactPhone && !contactEmail) return null;

  const phoneNorm = contactPhone ? normalizePhoneForCompare(contactPhone) : null;
  const emailNorm = contactEmail ? normalizeEmailForCompare(contactEmail) : null;

  // SQLite hat keine eingebaute Normalisierung — alle Leads laden und in JS vergleichen.
  // Bei wenigen Tausend Leads vertretbar; Indexsuche per superchat_contact_id deckt
  // den Hot Path nach erstem Match ohnehin ab.
  const all = db
    .select({
      id: leads.id,
      telefon: leads.telefon,
      email: leads.email,
      superchatContactId: leads.superchatContactId,
      name: leads.name,
    })
    .from(leads)
    .all();

  const match = all.find((l) => {
    if (phoneNorm && l.telefon && normalizePhoneForCompare(l.telefon) === phoneNorm) return true;
    if (emailNorm && l.email && normalizeEmailForCompare(l.email) === emailNorm) return true;
    return false;
  });

  if (match && contactId && !match.superchatContactId) {
    db.update(leads)
      .set({ superchatContactId: contactId, updatedAt: new Date().toISOString() })
      .where(eq(leads.id, match.id))
      .run();
  }

  return match || null;
}

const SUPPORTED_MESSAGE_EVENTS = new Set([
  "message_inbound",
  "message.received",
  "message_received",
  "message.created",
  "message_created",
  "conversation.message.created",
]);

const SUPPORTED_CONVERSATION_EVENTS = new Set([
  "conversation.closed",
  "conversation.archived",
]);

/**
 * Webhook fuer eingehende Superchat-Nachrichten und Konversations-Events.
 *
 * Auth:
 * - Bevorzugt: HMAC-SHA256 ueber raw body, Header X-Superchat-Signature,
 *   Secret in env SUPERCHAT_WEBHOOK_SECRET
 * - Fallback: x-api-key Header (api_keys-Tabelle)
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const auth = authenticate(req, rawBody);

  if (!auth.ok) {
    // Diagnose-Logging: Header-Namen (Werte gekuerzt) + erste 200 Zeichen Body.
    const headerKeys = Array.from(req.headers.keys());
    console.warn(
      `[superchat-webhook] 401 — ${auth.reason}. Headers=[${headerKeys.join(", ")}] BodyPreview=${rawBody.slice(0, 200)}`,
    );
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Body ist kein gueltiges JSON" }, { status: 400 });
  }

  // Superchat schickt das Event-Topic im Header `x-superchat-topic`, NICHT im Body.
  // Body-Form ist `{id: "pe_...", message: {...}}`. Wir fallen defensiv auf
  // alte `body.event`/`body.type`-Felder zurueck (fuer Tests, n8n-Relays etc.).
  const topicHeader = req.headers.get("x-superchat-topic") || "";
  const event = String(topicHeader || body.event || body.type || "");

  // ===== Event: Konversation geschlossen / archiviert =====
  if (SUPPORTED_CONVERSATION_EVENTS.has(event)) {
    const payload = (body.data || body.conversation || body) as Record<string, unknown>;
    const conversationId =
      (payload.conversation_id as string | undefined) || (payload.id as string | undefined);
    const contact = (payload.contact as Record<string, unknown> | undefined) || {};
    const contactId = (payload.contact_id as string | undefined) || (contact.id as string | undefined);
    const contactPhone = (contact.phone as string | undefined) || (payload.phone as string | undefined);
    const contactEmail = (contact.email as string | undefined) || (payload.email as string | undefined);
    const channel = (payload.channel as string | undefined) || "whatsapp";

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

    messages.sort((a, b) => {
      const ta = new Date((a.created_at as string) || (a.timestamp as string) || 0).getTime();
      const tb = new Date((b.created_at as string) || (b.timestamp as string) || 0).getTime();
      return ta - tb;
    });

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
        via: auth.via,
      },
      { status: 201 },
    );
  }

  // ===== Event: Einzelne Nachricht empfangen =====
  // Superchats echtes Format hat das Event NICHT im Body, sondern im
  // x-superchat-topic Header. Falls weder Header noch body.event vorhanden,
  // aber body.message existiert → als message_inbound interpretieren.
  const hasMessagePayload = !!body.message && typeof body.message === "object";
  if (!SUPPORTED_MESSAGE_EVENTS.has(event) && !(event === "" && hasMessagePayload)) {
    return NextResponse.json({ skipped: true, reason: `Event nicht unterstuetzt: ${event}` });
  }

  // Im echten Superchat-Schema ist `body.message` das Message-Objekt.
  // Fuer alte Formate (n8n-Relay, manuelle Tests) fallen wir auf body.data / body zurueck.
  const message = (body.message || body.data || body) as Record<string, unknown>;
  const contact = (message.contact as Record<string, unknown> | undefined) || {};
  const contactId =
    (message.contact_id as string | undefined) ||
    (message.contactId as string | undefined) ||
    (contact.id as string | undefined) ||
    (body.contact_id as string | undefined);
  const contactPhone =
    (contact.phone as string | undefined) ||
    (message.phone as string | undefined) ||
    (message.from as string | undefined);
  const contactEmail = (contact.email as string | undefined) || (message.email as string | undefined);
  const contactName = (contact.name as string | undefined) || (message.name as string | undefined);
  const channel =
    (message.channel as string | undefined) ||
    (body.channel as string | undefined) ||
    "whatsapp";

  // Inbound-only: outbound-Nachrichten von uns nicht doppelt protokollieren.
  // Superchat markiert Inbound mit message.status === "received" und
  // Outbound mit status "sent"/"delivered"/"read".
  const status = (message.status as string | undefined) || "";
  const direction = (message.direction as string | undefined) || (message.type as string | undefined);
  const isInbound =
    status === "received" ||
    direction === "inbound" ||
    direction === "incoming" ||
    (!status && !direction); // Falls beides fehlt: nicht skippen, weiterverarbeiten
  if (!isInbound) {
    return NextResponse.json({
      skipped: true,
      reason: `Outbound-Nachricht ignoriert (status=${status}, direction=${direction})`,
    });
  }

  // Text aus den verschiedenen moeglichen Stellen extrahieren.
  // Superchat: message.content.body fuer Text-Nachrichten.
  const body_ = message.body as { text?: string } | undefined;
  const content = message.content as { text?: string; body?: string; file_id?: string } | undefined;
  const text =
    content?.body ||
    content?.text ||
    body_?.text ||
    (message.text as string | undefined) ||
    "";

  if (!text) {
    // Datei-Nachrichten ohne Text: trotzdem Activity erstellen, damit die
    // Konversation am Lead nachvollziehbar bleibt.
    const isFileMessage = !!content?.file_id;
    if (!isFileMessage) {
      return NextResponse.json({ skipped: true, reason: "Leere Nachricht" });
    }
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

  const content2 = message.content as { file_id?: string } | undefined;
  const notizText = text || (content2?.file_id ? "(Datei-Anhang)" : "(leer)");

  const activity = db
    .insert(activities)
    .values({
      leadId: lead.id,
      datum: new Date().toISOString(),
      kontaktart: mapKontaktart(channel),
      notiz: `[Superchat ${channel}] ${notizText}`,
    })
    .returning()
    .get();

  return NextResponse.json(
    { matched: true, leadId: lead.id, leadName: lead.name, activityId: activity.id, via: auth.via },
    { status: 201 },
  );
}
