import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const archivedAt = body.restore ? null : new Date().toISOString();

  const result = db
    .update(leads)
    .set({ archivedAt, updatedAt: new Date().toISOString() })
    .where(eq(leads.id, body.id))
    .returning()
    .get();

  const { userId, userName } = getAuditUser(session);
  logAudit({
    userId, userName,
    action: body.restore ? "restore" : "archive",
    entity: "lead",
    entityId: body.id,
    entityName: result?.name,
  });

  return NextResponse.json(result);
}
