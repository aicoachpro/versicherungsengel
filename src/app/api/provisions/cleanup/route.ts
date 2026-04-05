import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

/**
 * DELETE /api/provisions/cleanup
 * Loescht alle nicht-bestaetigten Provisionen eines Imports.
 * Der Import-Datensatz bleibt als Historie erhalten.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { importId } = body;

  if (!importId) {
    return NextResponse.json({ error: "importId required" }, { status: 400 });
  }

  try {
    // Alle nicht-bestaetigten Provisionen dieses Imports loeschen
    const result = db.delete(provisions)
      .where(
        and(
          eq(provisions.importId, importId),
          eq(provisions.confirmed, false)
        )
      )
      .run();

    return NextResponse.json({ ok: true, deleted: result.changes });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
