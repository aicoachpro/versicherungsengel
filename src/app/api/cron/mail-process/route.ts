import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, inboundEmails, leadProducts, emailAccounts, leadAssignmentRules, providerProducts, leadProviders, activities } from "@/db/schema";
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
        }

        // Matching-Reihenfolge von spezifisch → unspezifisch:
        // 1. Provider + Produkt (exakt)
        // 2. Provider pauschal (Provider gesetzt, Produkt NULL)
        // 3. Produkt pauschal (Provider NULL, Produkt gesetzt) — NEU
        if (providerId && productId) {
          const specificRule = db
            .select({ userId: leadAssignmentRules.userId })
            .from(leadAssignmentRules)
            .where(
              and(
                eq(leadAssignmentRules.providerId, providerId),
                eq(leadAssignmentRules.productId, productId),
                eq(leadAssignmentRules.active, true),
              ),
            )
            .get();
          if (specificRule) assignedTo = specificRule.userId;
        }

        if (!assignedTo && providerId) {
          const providerRule = db
            .select({ userId: leadAssignmentRules.userId })
            .from(leadAssignmentRules)
            .where(
              and(
                eq(leadAssignmentRules.providerId, providerId),
                isNull(leadAssignmentRules.productId),
                eq(leadAssignmentRules.active, true),
              ),
            )
            .get();
          if (providerRule) assignedTo = providerRule.userId;
        }

        if (!assignedTo && productId) {
          const productRule = db
            .select({ userId: leadAssignmentRules.userId })
            .from(leadAssignmentRules)
            .where(
              and(
                isNull(leadAssignmentRules.providerId),
                eq(leadAssignmentRules.productId, productId),
                eq(leadAssignmentRules.active, true),
              ),
            )
            .get();
          if (productRule) assignedTo = productRule.userId;
        }
      } catch {
        // Tabellen existieren evtl. noch nicht
      }

      if (assignedTo) {
        console.log(`[mail-process] Lead "${leadName}" zugewiesen an User #${assignedTo} (Provider #${providerId})`);
      }

      // terminKosten dynamisch ermitteln:
      // 1. Spezifischer Preis aus provider_products (Anbieter + Produkt)
      // 2. Fallback: Pauschalpreis vom Anbieter (lead_providers.cost_per_lead)
      let terminKosten = 320;
      try {
        if (providerId && productId) {
          const ppRow = db
            .select({ costPerLead: providerProducts.costPerLead })
            .from(providerProducts)
            .where(
              and(
                eq(providerProducts.providerId, providerId),
                eq(providerProducts.productId, productId)
              )
            )
            .get();
          if (ppRow?.costPerLead != null) {
            terminKosten = ppRow.costPerLead;
          }
        }
        // Fallback: Pauschalpreis vom Anbieter
        if (terminKosten === 320 && providerId) {
          const provRow = db
            .select({ costPerLead: leadProviders.costPerLead })
            .from(leadProviders)
            .where(eq(leadProviders.id, providerId))
            .get();
          if (provRow?.costPerLead != null) {
            terminKosten = provRow.costPerLead;
          }
        }
      } catch {
        // Tabellen existieren evtl. noch nicht
      }

      console.log(`[mail-process] Lead "${leadName}" terminKosten: ${terminKosten} EUR`);

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
          terminKosten,
          productId: productId,
          providerId: providerId,
          assignedTo: assignedTo,
        })
        .returning()
        .get();

      // Automatische Aktivitaet: Lead-Eingang per Mail
      const providerName = providerId
        ? db.select({ name: leadProviders.name }).from(leadProviders).where(eq(leadProviders.id, providerId)).get()?.name
        : null;
      db.insert(activities).values({
        leadId: newLead.id,
        datum: new Date().toISOString(),
        kontaktart: "System",
        notiz: [
          `Lead eingegangen via E-Mail`,
          providerName ? `Anbieter: ${providerName}` : null,
          leadData.produkt ? `Produkt: ${leadData.produkt}` : null,
          `Betreff: ${email.subject || "—"}`,
        ].filter(Boolean).join("\n"),
      }).run();

      // E-Mail als verarbeitet markieren
      db.update(inboundEmails)
        .set({
          status: "done",
          processedAt: new Date().toISOString(),
          leadId: newLead.id,
        })
        .where(eq(inboundEmails.id, email.id))
        .run();

      // Automatisch an Superchat uebertragen (non-blocking)
      let superchatContactPhone: string | null = null;
      try {
        const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
        const syncRes = await fetch(`${baseUrl}/api/superchat/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": process.env.CRON_SECRET || "vf-cron-2024-secure",
          },
          body: JSON.stringify({ leadId: newLead.id }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          console.log(`[mail-process] Superchat-Sync fuer Lead #${newLead.id}: ${syncData.action}`);
          superchatContactPhone = syncData.transferred?.phone || null;
        } else {
          const syncErr = await syncRes.json().catch(() => ({}));
          console.log(`[mail-process] Superchat-Sync Skip fuer Lead #${newLead.id}: ${syncErr.error || syncRes.status}`);
        }
      } catch (syncErr) {
        console.log(`[mail-process] Superchat-Sync Fehler fuer Lead #${newLead.id}:`, syncErr instanceof Error ? syncErr.message : String(syncErr));
      }

      // Auto-WhatsApp fuer LeadCloser-Leads ausserhalb Geschaeftszeiten
      // VOE-138: Nur wenn productId gesetzt — sonst kein Versand mit Fallback-Text
      if (superchatContactPhone && providerId && productId) {
        try {
          const provRow = db
            .select({ name: leadProviders.name, superchatListId: leadProviders.superchatListId })
            .from(leadProviders)
            .where(eq(leadProviders.id, providerId))
            .get();

          // Nur fuer LeadCloser/CheckDirect (nicht Versicherungsengel)
          const isLeadCloser = provRow?.name?.toLowerCase().includes("check") ||
                               provRow?.name?.toLowerCase().includes("leadcloser") ||
                               provRow?.name?.toLowerCase().includes("lead closer");

          if (isLeadCloser) {
            // Zeitfenster: Sonntag ganzer Tag, Mo-Sa 20:00-08:00 (Europe/Berlin)
            const berlinTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
            const day = berlinTime.getDay(); // 0=So, 6=Sa
            const hour = berlinTime.getHours();
            const isOffHours = day === 0 || hour >= 20 || hour < 8;

            if (isOffHours) {
              // Produkt-Name hart pruefen — ohne echten Namen kein Versand
              const produktRow = db
                .select({ name: leadProducts.name })
                .from(leadProducts)
                .where(eq(leadProducts.id, productId))
                .get();
              const produktName = produktRow?.name;

              if (!produktName) {
                console.log(
                  `[mail-process] Auto-WhatsApp uebersprungen (Produkt-Name nicht auffindbar) fuer Lead #${newLead.id}`,
                );
              } else {
                const { sendTemplateMessage } = await import("@/lib/superchat");

                // Grussformel zusammenbauen
                const anrede = leadData.ansprechpartner
                  ? `Hallo ${leadData.ansprechpartner.split(" ")[0]},`
                  : "Hallo,";

                await sendTemplateMessage({
                  phone: superchatContactPhone,
                  channelId: "mc_93p5ySMwRlwDycW7PBvTX",
                  templateId: "tn_RjcDqQy2JuiapRhtM16w5",
                  variables: [
                    { position: 1, value: anrede },
                    { position: 2, value: produktName },
                  ],
                });
                console.log(`[mail-process] Auto-WhatsApp gesendet an ${superchatContactPhone} fuer Lead #${newLead.id}`);
              }
            } else {
              console.log(`[mail-process] Auto-WhatsApp uebersprungen (Geschaeftszeiten) fuer Lead #${newLead.id}`);
            }
          }
        } catch (waErr) {
          console.log(`[mail-process] Auto-WhatsApp Fehler fuer Lead #${newLead.id}:`, waErr instanceof Error ? waErr.message : String(waErr));
        }
      } else if (!productId && superchatContactPhone) {
        console.log(
          `[mail-process] Auto-WhatsApp uebersprungen (kein Lead-Produkt zugeordnet) fuer Lead #${newLead.id}`,
        );
      }

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
