import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, desc, sql, and, like, or } from "drizzle-orm";
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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
  const offset = Number(searchParams.get("offset") || 0);
  const entity = searchParams.get("entity");
  const action = searchParams.get("action");
  const search = searchParams.get("search");

  // Filter zusammenbauen
  const conditions = [];
  if (entity) {
    conditions.push(eq(auditLogs.entity, entity as "lead" | "insurance" | "activity" | "document" | "user"));
  }
  if (action) {
    conditions.push(eq(auditLogs.action, action as "create" | "update" | "delete" | "archive" | "restore"));
  }
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        like(auditLogs.userName, term),
        like(auditLogs.entityName, term),
        like(auditLogs.changes, term),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = where
    ? db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset)
        .all()
    : db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

  const totalResult = where
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(where)
        .get()
    : db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .get();

  return NextResponse.json({ logs, total: totalResult?.count || 0 });
}
