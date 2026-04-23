import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  if (leadId) {
    const result = db
      .select()
      .from(activities)
      .where(eq(activities.leadId, Number(leadId)))
      .orderBy(desc(activities.datum))
      .all();
    return NextResponse.json(result);
  }

  // Ohne leadId: alle Aktivitäten (für Wiedervorlage)
  const result = db
    .select()
    .from(activities)
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

  const { userId, userName } = getAuditUser(session);
  logAudit({ userId, userName, action: "create", entity: "activity", entityId: result.id, entityName: body.kontaktart });

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = db.select().from(activities).where(eq(activities.id, Number(body.id))).get();
  if (!existing) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

  const updates: Partial<typeof activities.$inferInsert> = {};
  if (typeof body.datum === "string") updates.datum = body.datum;
  if (typeof body.kontaktart === "string") updates.kontaktart = body.kontaktart;
  if ("notiz" in body) updates.notiz = body.notiz || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  db.update(activities).set(updates).where(eq(activities.id, Number(body.id))).run();

  const updated = db.select().from(activities).where(eq(activities.id, Number(body.id))).get();
  const { userId, userName } = getAuditUser(session);
  logAudit({
    userId,
    userName,
    action: "update",
    entity: "activity",
    entityId: Number(body.id),
    entityName: updated?.kontaktart,
    changes: updates as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  db.delete(activities).where(eq(activities.id, Number(id))).run();

  const { userId, userName } = getAuditUser(session);
  logAudit({ userId, userName, action: "delete", entity: "activity", entityId: Number(id) });

  return NextResponse.json({ success: true });
}
