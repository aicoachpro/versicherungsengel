import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities, apiKeys } from "@/db/schema";
import { eq, like, or } from "drizzle-orm";

// Public API endpoint for Claude Chat / external integrations
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

  if (!body.leadName && !body.leadId) {
    return NextResponse.json(
      { error: "leadName oder leadId ist ein Pflichtfeld" },
      { status: 400 }
    );
  }

  // Lead finden
  let lead;

  if (body.leadId) {
    lead = db.select().from(leads).where(eq(leads.id, Number(body.leadId))).get();
    if (!lead) {
      return NextResponse.json(
        { error: `Kein Lead mit ID ${body.leadId} gefunden` },
        { status: 404 }
      );
    }
  } else {
    const searchTerm = `%${body.leadName}%`;
    const matches = db
      .select({ id: leads.id, name: leads.name, ansprechpartner: leads.ansprechpartner, phase: leads.phase })
      .from(leads)
      .where(
        or(
          like(leads.name, searchTerm),
          like(leads.ansprechpartner, searchTerm)
        )
      )
      .all();

    if (matches.length === 0) {
      return NextResponse.json(
        {
          error: `Kein Lead gefunden für "${body.leadName}"`,
          hinweis: "Bitte den Operator nach dem korrekten Lead-Namen fragen.",
        },
        { status: 404 }
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        {
          error: `Mehrere Leads gefunden für "${body.leadName}"`,
          treffer: matches.map((m) => ({
            id: m.id,
            name: m.name,
            ansprechpartner: m.ansprechpartner,
            phase: m.phase,
          })),
          hinweis: "Bitte den Operator fragen, welcher Lead gemeint ist, und dann mit leadId erneut senden.",
        },
        { status: 300 }
      );
    }

    lead = matches[0];
  }

  // Aktivität anlegen
  const kontaktart = body.kontaktart || "Sonstiges";
  const validKontaktarten = ["Telefon", "E-Mail", "WhatsApp", "Vor-Ort", "LinkedIn", "Sonstiges"];
  const safeKontaktart = validKontaktarten.includes(kontaktart) ? kontaktart : "Sonstiges";

  const datum = body.datum || new Date().toISOString().slice(0, 16);
  const notiz = body.notiz || null;

  const result = db.insert(activities).values({
    leadId: lead.id,
    datum,
    kontaktart: safeKontaktart,
    notiz,
  }).returning().get();

  return NextResponse.json(
    {
      success: true,
      lead: { id: lead.id, name: lead.name },
      aktivitaet: result,
    },
    { status: 201 }
  );
}
