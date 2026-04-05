import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions, provisionImports } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/provisions/cancel
 * Loescht ALLE Provisionen eines Imports (bestaetigt + unbestaetigt)
 * UND den Import-Datensatz selbst.
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
    // 1. Alle Provisionen dieses Imports loeschen
    const result = db.delete(provisions)
      .where(eq(provisions.importId, importId))
      .run();

    // 2. Import-Datensatz loeschen
    db.delete(provisionImports)
      .where(eq(provisionImports.id, importId))
      .run();

    return NextResponse.json({ ok: true, deleted: result.changes });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
