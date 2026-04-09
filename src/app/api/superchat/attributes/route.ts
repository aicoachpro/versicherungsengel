import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, superchatAttributes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getCustomAttributes } from "@/lib/superchat";

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

/**
 * GET /api/superchat/attributes — List stored custom attributes.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const all = db
    .select()
    .from(superchatAttributes)
    .orderBy(sql`${superchatAttributes.name} ASC`)
    .all();

  return NextResponse.json(all);
}

/**
 * POST /api/superchat/attributes — Sync from Superchat API.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const result = await getCustomAttributes();
    const attrs = result?.results || [];

    if (!Array.isArray(attrs)) {
      return NextResponse.json({ error: "Unerwartetes Format von Superchat-API" }, { status: 500 });
    }

    // Alte Eintraege loeschen und neu einfuegen
    db.delete(superchatAttributes).run();
    const now = new Date().toISOString();
    for (const a of attrs) {
      if (!a.id || !a.name) continue;
      db.insert(superchatAttributes)
        .values({
          id: a.id,
          name: a.name,
          type: a.type || "text",
          optionValues: JSON.stringify(a.option_values || []),
          syncedAt: now,
        })
        .run();
    }

    return NextResponse.json({
      synced: attrs.length,
      timestamp: now,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Sync fehlgeschlagen: ${msg}` }, { status: 502 });
  }
}
