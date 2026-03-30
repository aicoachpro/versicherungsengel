import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

  const result = db
    .select()
    .from(activities)
    .where(eq(activities.leadId, Number(leadId)))
    .orderBy(desc(activities.datum))
    .all();

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.leadId || !body.datum || !body.kontaktart) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = db.insert(activities).values({
    leadId: body.leadId,
    datum: body.datum,
    kontaktart: body.kontaktart,
    notiz: body.notiz || null,
  }).returning().get();

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  db.delete(activities).where(eq(activities.id, Number(id))).run();
  return NextResponse.json({ success: true });
}
