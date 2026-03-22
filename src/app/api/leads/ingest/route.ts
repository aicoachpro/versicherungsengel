import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

// Public API endpoint for n8n / external integrations
// Authenticated via API key (Bearer token)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "API-Key erforderlich" }, { status: 401 });
  }

  const key = authHeader.replace("Bearer ", "");
  const validKey = db.select().from(apiKeys).where(eq(apiKeys.key, key)).get();
  if (!validKey) {
    return NextResponse.json({ error: "Ungültiger API-Key" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name ist ein Pflichtfeld" }, { status: 400 });
  }

  const result = db.insert(leads).values({
    name: body.name,
    phase: "Termin eingegangen",
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
