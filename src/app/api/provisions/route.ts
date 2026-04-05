import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions, leads } from "@/db/schema";
import { eq, desc, and, like, isNull, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const importId = searchParams.get("importId");
  const leadId = searchParams.get("leadId");
  const matched = searchParams.get("matched");
  const confirmed = searchParams.get("confirmed");
  const month = searchParams.get("month"); // Format: YYYY-MM
  const q = searchParams.get("q");

  // Filter zusammenbauen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (importId) {
    conditions.push(eq(provisions.importId, Number(importId)));
  }

  if (leadId) {
    conditions.push(eq(provisions.leadId, Number(leadId)));
  }

  if (matched === "true") {
    conditions.push(isNotNull(provisions.leadId));
  } else if (matched === "false") {
    conditions.push(isNull(provisions.leadId));
  }

  if (confirmed === "true") {
    conditions.push(eq(provisions.confirmed, true));
  } else if (confirmed === "false") {
    conditions.push(eq(provisions.confirmed, false));
  }

  if (month) {
    // buchungs_datum ist im Format DD.MM.YYYY — Monat filtern
    // Konvertiere YYYY-MM zu MM.YYYY Pattern für LIKE
    const [year, mon] = month.split("-");
    if (year && mon) {
      conditions.push(like(provisions.buchungsDatum, sql`${"%" + mon + "." + year}`));
    }
  }

  if (q) {
    conditions.push(
      sql`(${provisions.versNehmer} LIKE ${"%" + q + "%"} OR ${provisions.versNummer} LIKE ${"%" + q + "%"})`
    );
  }

  // Left Join mit leads für leadName
  const query = db
    .select({
      id: provisions.id,
      importId: provisions.importId,
      buchungsDatum: provisions.buchungsDatum,
      versNehmer: provisions.versNehmer,
      bsz: provisions.bsz,
      versNummer: provisions.versNummer,
      datevKonto: provisions.datevKonto,
      kontoName: provisions.kontoName,
      buchungstext: provisions.buchungstext,
      erfolgsDatum: provisions.erfolgsDatum,
      vtnr: provisions.vtnr,
      provBasis: provisions.provBasis,
      provSatz: provisions.provSatz,
      betrag: provisions.betrag,
      leadId: provisions.leadId,
      matchConfidence: provisions.matchConfidence,
      confirmed: provisions.confirmed,
      createdAt: provisions.createdAt,
      leadName: leads.name,
    })
    .from(provisions)
    .leftJoin(leads, eq(provisions.leadId, leads.id))
    .orderBy(
      // Unbestätigte Matches zuerst, dann bestätigte, dann unmatched
      sql`CASE
        WHEN ${provisions.leadId} IS NOT NULL AND ${provisions.confirmed} = 0 THEN 0
        WHEN ${provisions.leadId} IS NOT NULL AND ${provisions.confirmed} = 1 THEN 1
        ELSE 2
      END`,
      desc(provisions.id)
    );

  let rows;
  if (conditions.length > 0) {
    rows = query.where(and(...conditions)).all();
  } else {
    rows = query.all();
  }

  // Felder auf UI-Interface mappen
  const result = rows.map((r) => ({
    id: r.id,
    importId: r.importId,
    datum: r.buchungsDatum,
    versNehmer: r.versNehmer,
    versNr: r.versNummer,
    kontoName: r.kontoName,
    datevKonto: r.datevKonto,
    buchungstext: r.buchungstext,
    provBasis: r.provBasis,
    satz: r.provSatz,
    betrag: r.betrag,
    leadId: r.leadId,
    leadName: r.leadName,
    confirmed: r.confirmed,
  }));

  return NextResponse.json(result);
}
