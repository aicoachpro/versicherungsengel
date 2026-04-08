import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadAssignmentRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const ruleId = Number(id);
  if (!ruleId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const existing = db
    .select()
    .from(leadAssignmentRules)
    .where(eq(leadAssignmentRules.id, ruleId))
    .get();
  if (!existing) return NextResponse.json({ error: "Regel nicht gefunden" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.providerId !== undefined) updates.providerId = body.providerId;
  if (body.productId !== undefined) updates.productId = body.productId || null;
  if (body.userId !== undefined) updates.userId = body.userId;
  if (body.active !== undefined) updates.active = body.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Aenderungen" }, { status: 400 });
  }

  const result = db
    .update(leadAssignmentRules)
    .set(updates)
    .where(eq(leadAssignmentRules.id, ruleId))
    .returning()
    .get();

  return NextResponse.json(result);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const ruleId = Number(id);
  if (!ruleId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  db.delete(leadAssignmentRules).where(eq(leadAssignmentRules.id, ruleId)).run();

  return NextResponse.json({ ok: true });
}
