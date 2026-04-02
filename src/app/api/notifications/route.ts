import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, sql, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = db
    .select()
    .from(notifications)
    .orderBy(sql`${notifications.createdAt} DESC`)
    .limit(20)
    .all();

  const unreadCount = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(isNull(notifications.readAt))
    .get();

  return NextResponse.json({ notifications: items, unreadCount: unreadCount?.count || 0 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const now = new Date().toISOString();

  if (body.markAllRead) {
    db.update(notifications)
      .set({ readAt: now })
      .where(isNull(notifications.readAt))
      .run();
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    db.update(notifications)
      .set({ readAt: now })
      .where(eq(notifications.id, body.id))
      .run();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Missing id or markAllRead" }, { status: 400 });
}
