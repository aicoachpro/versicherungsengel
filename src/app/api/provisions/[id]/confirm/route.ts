import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { leadId } = body;

  if (leadId === undefined) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  try {
    if (leadId === null) {
      // Ablehnung: leadId auf null setzen, aber confirmed=true (manuell abgelehnt)
      db.update(provisions)
        .set({ leadId: null, matchConfidence: null, confirmed: true })
        .where(eq(provisions.id, parseInt(id)))
        .run();
    } else {
      // Bestätigung: leadId setzen/beibehalten + confirmed=true
      db.update(provisions)
        .set({ leadId, matchConfidence: 1.0, confirmed: true })
        .where(eq(provisions.id, parseInt(id)))
        .run();
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
