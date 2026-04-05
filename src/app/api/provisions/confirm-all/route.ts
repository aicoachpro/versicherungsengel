import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, isNotNull } from "drizzle-orm";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { importId } = body;

  if (!importId) {
    return NextResponse.json({ error: "importId required" }, { status: 400 });
  }

  try {
    // Alle unbestätigten Matches für diesen Import bestätigen
    const result = db.update(provisions)
      .set({ confirmed: true })
      .where(
        and(
          eq(provisions.importId, importId),
          eq(provisions.confirmed, false),
          isNotNull(provisions.leadId)
        )
      )
      .run();

    return NextResponse.json({ ok: true, confirmed: result.changes });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
