import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
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

  const logs = entity
    ? db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entity, entity as "lead" | "insurance" | "activity" | "document" | "user"))
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

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .get();

  return NextResponse.json({ logs, total: total?.count || 0 });
}
