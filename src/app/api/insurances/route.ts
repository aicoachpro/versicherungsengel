import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { insurances, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  if (leadId) {
    const result = db
      .select()
      .from(insurances)
      .where(eq(insurances.leadId, Number(leadId)))
      .orderBy(insurances.ablauf)
      .all();
    return NextResponse.json(result);
  }

  const all = db
    .select({
      id: insurances.id,
      bezeichnung: insurances.bezeichnung,
      leadId: insurances.leadId,
      leadName: leads.name,
      sparte: insurances.sparte,
      versicherer: insurances.versicherer,
      beitrag: insurances.beitrag,
      zahlweise: insurances.zahlweise,
      ablauf: insurances.ablauf,
      umfang: insurances.umfang,
      notizen: insurances.notizen,
      produkt: insurances.produkt,
      createdAt: insurances.createdAt,
    })
    .from(insurances)
    .leftJoin(leads, eq(insurances.leadId, leads.id))
    .orderBy(insurances.bezeichnung)
    .all();

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = db.insert(insurances).values({
    bezeichnung: body.bezeichnung,
    leadId: body.leadId || null,
    sparte: body.sparte || null,
    versicherer: body.versicherer || null,
    beitrag: body.beitrag || null,
    zahlweise: body.zahlweise || null,
    ablauf: body.ablauf || null,
    umfang: body.umfang || null,
    notizen: body.notizen || null,
    produkt: body.produkt || null,
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
    .update(insurances)
    .set(updates)
    .where(eq(insurances.id, id))
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

  db.delete(insurances).where(eq(insurances.id, Number(id))).run();
  return NextResponse.json({ success: true });
}
