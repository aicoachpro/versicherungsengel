import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadProducts, activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { sendTemplateMessage, updateContact } from "@/lib/superchat";
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

    // Superchat-Kontakt ermitteln: Falls noch keine ID am Lead haengt,
    // rufen wir den bestehenden Sync-Endpoint auf. Der hat ausgefeilte
    // Handle-Kollisions-/Geister-Kontakt-Logik und speichert die ID am Lead.
    let contactId = lead.superchatContactId;

    if (!contactId) {
      const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
      const syncRes = await fetch(`${baseUrl}/api/superchat/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": process.env.CRON_SECRET || "vf-cron-2024-secure",
        },
        body: JSON.stringify({ leadId }),
      });
      if (!syncRes.ok) {
        const data = await syncRes.json().catch(() => ({}));
        throw new Error(
          `Superchat-Kontakt-Sync fehlgeschlagen: ${data.error || syncRes.status}`,
        );
      }
      // Lead neu laden um die frische Kontakt-ID zu bekommen
      const refreshed = db.select().from(leads).where(eq(leads.id, leadId)).get();
      contactId = refreshed?.superchatContactId || null;
    }

    if (!contactId) {
      return NextResponse.json(
        { error: "Kein Superchat-Kontakt ermittelt" },
        { status: 500 },
      );
    }

    // Name/E-Mail am bestehenden Kontakt aktualisieren (best effort)
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

    // Produkt ist Pflicht — die Superchat-Automation matcht darauf
    if (!lead.productId) {
      return NextResponse.json(
        {
          error:
            "Bitte zuerst das Lead-Produkt am Lead eintragen — die Superchat-Automation braucht es fuer die Vorlagen-Variable.",
          code: "missing_product",
        },
        { status: 400 },
      );
    }
    const prod = db
      .select({ name: leadProducts.name })
      .from(leadProducts)
      .where(eq(leadProducts.id, lead.productId))
      .get();
    if (!prod) {
      return NextResponse.json(
        { error: "Lead-Produkt nicht gefunden", code: "invalid_product" },
        { status: 400 },
      );
    }
    const produktName = prod.name;

    // Anrede zusammenbauen
    const anrede = lead.ansprechpartner
      ? `Hallo ${lead.ansprechpartner.split(" ")[0]},`
      : "Hallo,";

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
