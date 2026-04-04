import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions, provisionImports, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { parseProvisionCSV } from "@/lib/provision-parser";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin-only
  const role = (session.user as unknown as { role: string })?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen Provisionen importieren" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
  }

  // CSV einlesen — versuche Latin1 Decoding für Mojibake-Fix
  let csvText: string;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Prüfe auf UTF-8 BOM und versuche Latin1 Decoding
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // Hat UTF-8 BOM — trotzdem als Latin1 lesen, da die Datei oft
    // fälschlich als UTF-8 markiert ist
    csvText = buffer.subarray(3).toString("latin1");
  } else {
    csvText = buffer.toString("latin1");
  }

  const parsed = parseProvisionCSV(csvText);

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Keine Provisionszeilen in der Datei gefunden" }, { status: 400 });
  }

  // Alle Leads laden für Matching
  const allLeads = db.select({ id: leads.id, name: leads.name }).from(leads).all();

  // Import-Datensatz anlegen
  const totalBetrag = parsed.reduce((sum, p) => sum + p.betrag, 0);
  const importRecord = db.insert(provisionImports).values({
    filename: file.name,
    importDate: new Date().toISOString().split("T")[0],
    totalRows: parsed.length,
    totalBetrag,
    matchedRows: 0,
    unmatchedRows: 0,
  }).returning().get();

  let matched = 0;
  let unmatched = 0;

  for (const row of parsed) {
    // Fuzzy-Matching: Lead-Name enthält versNehmer oder umgekehrt
    const versNehmerLower = row.versNehmer.toLowerCase();
    let matchedLeadId: number | null = null;
    let confidence: number | null = null;

    for (const lead of allLeads) {
      const leadNameLower = lead.name.toLowerCase();
      if (leadNameLower === versNehmerLower) {
        matchedLeadId = lead.id;
        confidence = 1.0;
        break;
      }
      if (leadNameLower.includes(versNehmerLower) || versNehmerLower.includes(leadNameLower)) {
        matchedLeadId = lead.id;
        // Kürzerer Name im längeren → Confidence basiert auf Längenverhältnis
        const shorter = Math.min(leadNameLower.length, versNehmerLower.length);
        const longer = Math.max(leadNameLower.length, versNehmerLower.length);
        confidence = shorter / longer;
        // Weitersuchen, falls exakter Match kommt
      }
    }

    if (matchedLeadId) {
      matched++;
    } else {
      unmatched++;
    }

    db.insert(provisions).values({
      importId: importRecord.id,
      buchungsDatum: row.buchungsDatum,
      versNehmer: row.versNehmer,
      bsz: row.bsz,
      versNummer: row.versNummer,
      datevKonto: row.datevKonto,
      kontoName: row.kontoName,
      buchungstext: row.buchungstext,
      erfolgsDatum: row.erfolgsDatum,
      vtnr: row.vtnr,
      provBasis: row.provBasis,
      provSatz: row.provSatz,
      betrag: row.betrag,
      leadId: matchedLeadId,
      matchConfidence: confidence,
    }).run();
  }

  // Import-Datensatz aktualisieren
  db.update(provisionImports)
    .set({ matchedRows: matched, unmatchedRows: unmatched })
    .where(eq(provisionImports.id, importRecord.id))
    .run();

  return NextResponse.json({
    importId: importRecord.id,
    totalRows: parsed.length,
    matched,
    unmatched,
    totalBetrag: Math.round(totalBetrag * 100) / 100,
  }, { status: 201 });
}
