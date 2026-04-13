import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadProducts, activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { sendTemplateMessage, createContact, findContactByHandle, updateContact } from "@/lib/superchat";
import { getSetting } from "@/lib/settings";

/**
 * POST /api/leads/whatsapp
 * Sendet eine WhatsApp-Vorlagen-Nachricht an einen Lead via Superchat.
 * Body: { leadId: number }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { leadId } = body;
  if (!leadId) return NextResponse.json({ error: "leadId fehlt" }, { status: 400 });

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });

  // Phone aus Request oder vom Lead nehmen
  const phone = (body.phone?.trim() || lead.telefon?.trim());
  if (!phone) return NextResponse.json({ error: "Keine Telefonnummer" }, { status: 400 });

  // Telefon am Lead updaten falls aus Request
  if (body.phone && body.phone.trim() !== (lead.telefon || "").trim()) {
    db.update(leads).set({ telefon: body.phone.trim(), updatedAt: new Date().toISOString() }).where(eq(leads.id, leadId)).run();
  }

  const apiKey = getSetting("superchat.apiKey") || process.env.SUPERCHAT_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Superchat nicht konfiguriert" }, { status: 400 });

  try {
    const nameParts = (lead.ansprechpartner || lead.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Superchat-Kontakt finden oder anlegen
    let contactId = lead.superchatContactId;
    let contactWasExisting = false;

    if (!contactId) {
      // 1. Zuerst versuchen, den Kontakt anhand der Telefonnummer zu finden
      const existing = await findContactByHandle(phone);
      if (existing) {
        contactId = existing.id;
        contactWasExisting = true;
      } else {
        // 2. Versuchen, neu anzulegen — bei 409 fallback auf nochmalige Suche
        try {
          const newContact = await createContact({
            first_name: firstName,
            last_name: lastName,
            phone,
            email: lead.email || undefined,
          });
          contactId = newContact.id;
        } catch (err) {
          const isConflict = err instanceof Error && /409/.test(err.message);
          if (!isConflict) throw err;

          // Kontakt existiert laut Superchat bereits — erneut suchen (evtl. neue Kontakte)
          const retry = await findContactByHandle(phone);
          if (!retry) {
            throw new Error(
              "Superchat meldet: Kontakt existiert bereits, konnte aber nicht gefunden werden. Bitte Nummer pruefen oder Kontakt manuell im Superchat zuordnen.",
            );
          }
          contactId = retry.id;
          contactWasExisting = true;
        }
      }
      // Kontakt-ID am Lead speichern
      db.update(leads)
        .set({ superchatContactId: contactId, updatedAt: new Date().toISOString() })
        .where(eq(leads.id, leadId))
        .run();
    } else {
      // Lead hatte bereits eine gespeicherte Kontakt-ID
      contactWasExisting = true;
    }

    if (!contactId) {
      return NextResponse.json({ error: "Kein Superchat-Kontakt ermittelt" }, { status: 500 });
    }

    // Bei bereits existierenden Kontakten: Name/E-Mail aktualisieren (best effort)
    if (contactWasExisting) {
      try {
        await updateContact(contactId, {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          email: lead.email || undefined,
        });
      } catch (updateErr) {
        console.log(
          `[whatsapp] Kontakt-Update fehlgeschlagen fuer ${contactId}:`,
          updateErr instanceof Error ? updateErr.message : String(updateErr),
        );
      }
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
      notiz: `Erstnachricht versendet per WhatsApp: ${anrede} Produkt: ${produktName}`,
    }).run();

    const { userId, userName } = getAuditUser(session);
    logAudit({ userId, userName, action: "whatsapp_send", entity: "lead", entityId: leadId, entityName: lead.name });

    return NextResponse.json({ success: true, contactId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `WhatsApp-Versand fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
