import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { searchContacts } from "@/lib/superchat";

/**
 * Superchat-Kontakte suchen (für Verknüpfung mit Lead).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("search");

  if (!query) {
    return NextResponse.json({ error: "search-Parameter erforderlich" }, { status: 400 });
  }

  try {
    const result = await searchContacts(query);
    const contacts = result.data || result;
    return NextResponse.json(contacts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Superchat-Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Superchat-Kontakt mit Lead verknüpfen.
 * Body: { leadId: number, superchatContactId: string }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { leadId, superchatContactId } = body;

  if (!leadId || !superchatContactId) {
    return NextResponse.json({ error: "leadId und superchatContactId sind Pflichtfelder" }, { status: 400 });
  }

  const result = db
    .update(leads)
    .set({ superchatContactId, updatedAt: new Date().toISOString() })
    .where(eq(leads.id, leadId))
    .returning()
    .get();

  return NextResponse.json(result);
}
