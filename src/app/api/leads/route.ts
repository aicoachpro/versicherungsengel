import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allLeads = db.select().from(leads).orderBy(sql`${leads.updatedAt} DESC`).all();
  return NextResponse.json(allLeads);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = db.insert(leads).values({
    name: body.name,
    phase: body.phase || "Termin eingegangen",
    termin: body.termin || null,
    ansprechpartner: body.ansprechpartner || null,
    email: body.email || null,
    telefon: body.telefon || null,
    website: body.website || null,
    branche: body.branche || null,
    unternehmensgroesse: body.unternehmensgroesse || null,
    umsatzklasse: body.umsatzklasse || null,
    terminKosten: body.terminKosten ?? 320,
    umsatz: body.umsatz || null,
    conversion: body.conversion || null,
    naechsterSchritt: body.naechsterSchritt || null,
    notizen: body.notizen || null,
    eingangsdatum: body.eingangsdatum || new Date().toISOString().split("T")[0],
  }).returning().get();

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { id, ...updates } = body;
  updates.updatedAt = new Date().toISOString();

  const result = db
    .update(leads)
    .set(updates)
    .where(eq(leads.id, id))
    .returning()
    .get();

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  db.delete(leads).where(eq(leads.id, Number(id))).run();
  return NextResponse.json({ success: true });
}
