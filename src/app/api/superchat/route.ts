import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * Superchat-Kontakt-ID mit Lead verknüpfen / entfernen.
 * Body: { leadId: number, superchatContactId: string | null }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { leadId, superchatContactId } = body;

  if (!leadId) {
    return NextResponse.json({ error: "leadId ist Pflichtfeld" }, { status: 400 });
  }

  const result = db
    .update(leads)
    .set({ superchatContactId: superchatContactId ?? null, updatedAt: new Date().toISOString() })
    .where(eq(leads.id, leadId))
    .returning()
    .get();

  return NextResponse.json(result);
}
