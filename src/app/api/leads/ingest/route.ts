import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { validateApiRequest } from "@/lib/api-auth";

// Deutsches Datum (TT.MM.JJJJ HH:MM) → ISO (JJJJ-MM-TTTHH:MM)
function parseTermin(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}`;
  }
  // Nur Datum ohne Uhrzeit: TT.MM.JJJJ
  const dateOnly = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dateOnly) {
    return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;
  }
  // Bereits ISO-Format oder anderes gültiges Format
  return value;
}

// Public API endpoint for n8n / external integrations
// Authenticated via API key (Bearer token) + Rate-Limited
export async function POST(req: NextRequest) {
  const auth = validateApiRequest(req);
  if (!auth.authorized) return auth.response!;

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name ist ein Pflichtfeld" }, { status: 400 });
  }

  const result = db.insert(leads).values({
    name: body.name,
    phase: "Termin eingegangen",
    termin: parseTermin(body.termin),
    ansprechpartner: body.ansprechpartner || null,
    email: body.email || null,
    telefon: body.telefon || null,
    website: body.website || null,
    gewerbeart: body.gewerbeart || null,
    branche: body.branche || null,
    unternehmensgroesse: body.unternehmensgroesse || null,
    umsatzklasse: body.umsatzklasse || null,
    terminKosten: body.terminKosten ?? 320,
    naechsterSchritt: body.naechsterSchritt || null,
    notizen: body.notizen || null,
    eingangsdatum: new Date().toISOString().split("T")[0],
  }).returning().get();

  return NextResponse.json({ success: true, lead: result }, { status: 201 });
}
