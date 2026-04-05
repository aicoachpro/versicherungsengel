import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const TYP_LABELS: Record<string, string> = {
  abschluss: "Abschlussprovision",
  folge: "Folgeprovision",
  tippgeber: "Tippgeber-Provision",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId, versNummer, betrag, typ, datum, notiz } = body;

  // Validierung
  if (!leadId || typeof leadId !== "number") {
    return NextResponse.json({ error: "leadId ist erforderlich" }, { status: 400 });
  }
  if (!betrag || typeof betrag !== "number") {
    return NextResponse.json({ error: "betrag ist erforderlich" }, { status: 400 });
  }
  if (!typ || !TYP_LABELS[typ]) {
    return NextResponse.json(
      { error: "typ muss 'abschluss', 'folge' oder 'tippgeber' sein" },
      { status: 400 }
    );
  }
  if (!datum) {
    return NextResponse.json({ error: "datum ist erforderlich" }, { status: 400 });
  }

  // Lead-Name nachschlagen
  const lead = db.select({ name: leads.name }).from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) {
    return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
  }

  // Datum von YYYY-MM-DD zu DD.MM.YYYY konvertieren (DATEV-Format)
  const [year, month, day] = datum.split("-");
  const buchungsDatum = `${day}.${month}.${year}`;

  const typLabel = TYP_LABELS[typ];
  const buchungstext = notiz?.trim() || typLabel;

  const result = db
    .insert(provisions)
    .values({
      importId: 0, // Spezialwert fuer manuelle Eingaben
      buchungsDatum,
      versNehmer: lead.name,
      versNummer: versNummer?.trim() || null,
      datevKonto: null,
      kontoName: typLabel,
      buchungstext,
      betrag,
      leadId,
      matchConfidence: 1.0,
      confirmed: true,
    })
    .run();

  return NextResponse.json({
    id: result.lastInsertRowid,
    message: "Provision erfolgreich erfasst",
  });
}
