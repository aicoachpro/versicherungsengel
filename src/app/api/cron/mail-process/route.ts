import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, inboundEmails, leadProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractLeadFromText } from "@/lib/ai-client";
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

      // KI-Extraktion
      const aiResponse = await extractLeadFromText(extractionText);

      // JSON aus der Antwort parsen (robust: auch bei Extra-Text oder abgeschnittener Antwort)
      let leadData: Record<string, string>;
      try {
        const cleaned = aiResponse.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        // Erstes JSON-Objekt aus der Antwort extrahieren
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Kein JSON gefunden");
        leadData = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error(`KI-Antwort ist kein valides JSON: ${aiResponse.substring(0, 200)}`);
      }

      // Lead erstellen — selbes Pattern wie POST /api/leads
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

      const newLead = db
        .insert(leads)
        .values({
          name: leadName,
          phase: "Termin eingegangen",
          ansprechpartner: leadData.ansprechpartner || null,
          email: leadData.email || email.fromAddress || null,
          telefon: leadData.telefon || null,
          website: leadData.website || null,
          notizen: notizText,
          eingangsdatum: eingangsDatum,
          terminKosten: 320,
          productId: productId,
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
