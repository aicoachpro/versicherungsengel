import { NextResponse } from "next/server";
import { db } from "@/db";
import { leadProviders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * GET /api/lead-providers/active
 * Liefert nur id + name der aktiven Provider (fuer Lead-Dialog Dropdown).
 * Erreichbar fuer alle authentifizierten Nutzer.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const active = db
      .select({ id: leadProviders.id, name: leadProviders.name })
      .from(leadProviders)
      .where(eq(leadProviders.active, true))
      .orderBy(sql`${leadProviders.name}`)
      .all();

    return NextResponse.json(active);
  } catch {
    // Tabelle existiert noch nicht
    return NextResponse.json([]);
  }
}
