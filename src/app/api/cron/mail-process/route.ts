import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, inboundEmails, leadProducts, emailAccounts, leadAssignmentRules } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { extractLeadFromEmail } from "@/lib/ai-client";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pending E-Mails laden (max 5 pro Durchlauf)
  const pendingEmails = db
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.status, "pending"))
    .limit(5)
    .all();

  if (pendingEmails.length === 0) {
    return NextResponse.json({ processed: 0, errors: 0, message: "Keine pendenten E-Mails" });
  }

  let processed = 0;
  let errorCount = 0;

  for (const email of pendingEmails) {
    try {
      // Vorfilter: Nur potenzielle Neukunden-Mails verarbeiten
      const subject = (email.subject || "").toLowerCase();
      const isNotLead =
        /^(re:|aw:|fwd:|wg:)/i.test(subject) ||
        /reklamation/i.test(subject) ||
        /auftragsbestätigung|buchungsbestätigung|zahlungsbestätigung|abmeldebestätigung/i.test(subject) ||
        /abwesenheit|out of office|autoreply|auto-reply/i.test(subject) ||
        /newsletter|unsubscribe|abmelden/i.test(subject) ||
        /rechnung|invoice|mahnung/i.test(subject) ||
        /intern|passwort|password/i.test(subject);

      if (isNotLead) {
        db.update(inboundEmails)
          .set({ status: "skipped", errorMessage: "Keine Neukunden-Mail (Vorfilter)" })
          .where(eq(inboundEmails.id, email.id))
          .run();
        console.log(`[mail-process] Übersprungen (kein Neukunde): "${email.subject}"`);
        continue;
      }

      // Status auf "processing" setzen
      db.update(inboundEmails)
        .set({ status: "processing" })
        .where(eq(inboundEmails.id, email.id))
        .run();

      // Text zusammenbauen fuer KI-Extraktion
      const extractionText = [
        `Betreff: ${email.subject}`,
        email.fromName
          ? `Von: ${email.fromName} <${email.fromAddress}>`
          : `Von: ${email.fromAddress}`,
        "",
        email.body,
      ].join("\n");

      // KI-Extraktion (Mistral JSON-Modus, wie n8n-Workflow)
      const aiResponse = await extractLeadFromEmail(extractionText);

      // JSON parsen (mit leadDaten-Wrapper-Handling wie n8n)
      let leadData: Record<string, string>;
      try {
        const parsed = JSON.parse(aiResponse);
        leadData = parsed.leadDaten || parsed;
      } catch {
        // Fallback: JSON aus Text extrahieren
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error(`KI-Antwort ist kein valides JSON: ${aiResponse.substring(0, 200)}`);
        const parsed = JSON.parse(jsonMatch[0]);
        leadData = parsed.leadDaten || parsed;
      }

      // Lead erstellen
      const leadName: string = leadData.name || email.fromName || email.fromAddress;
      if (!leadName) {
        throw new Error("Kein Name aus E-Mail extrahierbar");
      }

      const notizText = leadData.notizen
        ? `${leadData.notizen}\n\n--- Importiert aus E-Mail ---\nVon: ${email.fromAddress}\nBetreff: ${email.subject}`
        : `Importiert aus E-Mail\nVon: ${email.fromAddress}\nBetreff: ${email.subject}`;

      const eingangsDatum = email.receivedAt
        ? email.receivedAt.split("T")[0]
        : new Date().toISOString().split("T")[0];

      // Termin aus KI-Antwort (Format TT.MM.JJJJ HH:MM → ISO)
      let termin: string | null = null;
      if (leadData.termin && leadData.termin !== "null") {
        const match = leadData.termin.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
        if (match) {
          termin = `${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}`;
        }
      }

      // Produkt-ID aus lead_products-Tabelle ermitteln
      let productId: number | null = null;
      if (leadData.produkt) {
        try {
          const product = db
            .select({ id: leadProducts.id })
            .from(leadProducts)
            .where(eq(leadProducts.name, leadData.produkt))
            .get();
          if (product) productId = product.id;
        } catch {
          // lead_products Tabelle existiert evtl. noch nicht
        }
      }

      // Provider-ID aus E-Mail-Konto ermitteln
      let providerId: number | null = null;
      let assignedTo: number | null = null;
      try {
        const account = db
          .select({ providerId: emailAccounts.providerId })
          .from(emailAccounts)
          .where(eq(emailAccounts.id, email.accountId))
          .get();
        if (account?.providerId) {
          providerId = account.providerId;

          // Zuweisungsregel suchen: erst spezifisch (Anbieter + Produkt), dann pauschal (Anbieter)
          if (productId) {
            const specificRule = db
              .select({ userId: leadAssignmentRules.userId })
              .from(leadAssignmentRules)
              .where(
                and(
                  eq(leadAssignmentRules.providerId, providerId),
                  eq(leadAssignmentRules.productId, productId),
                  eq(leadAssignmentRules.active, true)
                )
              )
              .get();
            if (specificRule) assignedTo = specificRule.userId;
          }

          // Fallback: Pauschalregel (ohne Produkt)
          if (!assignedTo) {
            const defaultRule = db
              .select({ userId: leadAssignmentRules.userId })
              .from(leadAssignmentRules)
              .where(
                and(
                  eq(leadAssignmentRules.providerId, providerId),
                  isNull(leadAssignmentRules.productId),
                  eq(leadAssignmentRules.active, true)
                )
              )
              .get();
            if (defaultRule) assignedTo = defaultRule.userId;
          }
        }
      } catch {
        // Tabellen existieren evtl. noch nicht
      }

      if (assignedTo) {
        console.log(`[mail-process] Lead "${leadName}" zugewiesen an User #${assignedTo} (Provider #${providerId})`);
      }

      const newLead = db
        .insert(leads)
        .values({
          name: leadName,
          phase: "Termin eingegangen",
          termin,
          ansprechpartner: leadData.ansprechpartner || null,
          email: leadData.email || email.fromAddress || null,
          telefon: leadData.telefon || null,
          website: leadData.website || null,
          strasse: leadData.strasse || null,
          plz: leadData.plz || null,
          ort: leadData.ort || null,
          branche: (leadData.branche as typeof leads.branche.enumValues[number]) || null,
          gewerbeart: (leadData.gewerbeart as typeof leads.gewerbeart.enumValues[number]) || null,
          unternehmensgroesse: (leadData.unternehmensgroesse as typeof leads.unternehmensgroesse.enumValues[number]) || null,
          umsatzklasse: (leadData.umsatzklasse as typeof leads.umsatzklasse.enumValues[number]) || null,
          naechsterSchritt: leadData.naechsterSchritt || null,
          notizen: notizText,
          eingangsdatum: eingangsDatum,
          terminKosten: 320,
          productId: productId,
          providerId: providerId,
          assignedTo: assignedTo,
        })
        .returning()
        .get();

      // E-Mail als verarbeitet markieren
      db.update(inboundEmails)
        .set({
          status: "done",
          processedAt: new Date().toISOString(),
          leadId: newLead.id,
        })
        .where(eq(inboundEmails.id, email.id))
        .run();

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mail-process] Fehler bei E-Mail #${email.id}:`, message);

      // E-Mail als Fehler markieren
      db.update(inboundEmails)
        .set({
          status: "error",
          errorMessage: message,
        })
        .where(eq(inboundEmails.id, email.id))
        .run();

      errorCount++;
    }
  }

  return NextResponse.json({ processed, errors: errorCount });
}
