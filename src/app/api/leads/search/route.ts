import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, apiKeys, insurances, activities } from "@/db/schema";
import { eq, like, or, desc } from "drizzle-orm";

// Public API endpoint for MCP Server / external integrations
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
  const { query, leadId } = body;

  // Einzelnen Lead mit Details abrufen
  if (leadId) {
    const lead = db.select().from(leads).where(eq(leads.id, Number(leadId))).get();
    if (!lead) {
      return NextResponse.json({ error: `Kein Lead mit ID ${leadId} gefunden` }, { status: 404 });
    }

    const vertrage = db.select().from(insurances).where(eq(insurances.leadId, lead.id)).all();
    const aktivitaeten = db.select().from(activities).where(eq(activities.leadId, lead.id)).orderBy(desc(activities.datum)).all();

    return NextResponse.json({ lead, vertrage, aktivitaeten });
  }

  // Suche nach Name/Ansprechpartner
  if (!query) {
    return NextResponse.json({ error: "query oder leadId erforderlich" }, { status: 400 });
  }

  const searchTerm = `%${query}%`;
  const matches = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      phase: leads.phase,
      branche: leads.branche,
      email: leads.email,
      telefon: leads.telefon,
      archivedAt: leads.archivedAt,
    })
    .from(leads)
    .where(
      or(
        like(leads.name, searchTerm),
        like(leads.ansprechpartner, searchTerm)
      )
    )
    .all();

  return NextResponse.json({ treffer: matches, anzahl: matches.length });
}
