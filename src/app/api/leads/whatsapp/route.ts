import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadProducts, activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { sendTemplateMessage, createContact, findContactByHandle } from "@/lib/superchat";
import { getSetting } from "@/lib/settings";

/**
 * POST /api/leads/whatsapp
 * Sendet eine WhatsApp-Vorlagen-Nachricht an einen Lead via Superchat.
 * Body: { leadId: number }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId fehlt" }, { status: 400 });

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });

  const phone = lead.telefon?.trim();
  if (!phone) return NextResponse.json({ error: "Keine Telefonnummer hinterlegt" }, { status: 400 });

  const apiKey = getSetting("superchat.apiKey") || process.env.SUPERCHAT_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Superchat nicht konfiguriert" }, { status: 400 });

  try {
    // Superchat-Kontakt finden oder anlegen
    let contactId = lead.superchatContactId;
    if (!contactId) {
      const existing = await findContactByHandle(phone);
      if (existing) {
        contactId = existing.id;
      } else {
        const nameParts = (lead.ansprechpartner || lead.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const newContact = await createContact({
          first_name: firstName,
          last_name: lastName,
          phone,
          email: lead.email || undefined,
        });
        contactId = newContact.id;
      }
      // Kontakt-ID am Lead speichern
      db.update(leads)
        .set({ superchatContactId: contactId, updatedAt: new Date().toISOString() })
        .where(eq(leads.id, leadId))
        .run();
    }

    // Anrede zusammenbauen
    const anrede = lead.ansprechpartner
      ? `Hallo ${lead.ansprechpartner.split(" ")[0]},`
      : "Hallo,";

    // Produkt-Name
    let produktName = "Versicherung";
    if (lead.productId) {
      const prod = db.select({ name: leadProducts.name }).from(leadProducts).where(eq(leadProducts.id, lead.productId)).get();
      if (prod) produktName = prod.name;
    }

    // Template senden
    await sendTemplateMessage({
      phone,
      channelId: "mc_93p5ySMwRlwDycW7PBvTX",
      templateId: "tn_RjcDqQy2JuiapRhtM16w5",
      variables: [
        { position: 1, value: anrede },
        { position: 2, value: produktName },
      ],
    });

    // Aktivitaet loggen
    db.insert(activities).values({
      leadId,
      datum: new Date().toISOString(),
      kontaktart: "WhatsApp",
      notiz: `WhatsApp-Vorlage gesendet: ${anrede} Produkt: ${produktName}`,
    }).run();

    const { userId, userName } = getAuditUser(session);
    logAudit({ userId, userName, action: "whatsapp_send", entity: "lead", entityId: leadId, entityName: lead.name });

    return NextResponse.json({ success: true, contactId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `WhatsApp-Versand fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
