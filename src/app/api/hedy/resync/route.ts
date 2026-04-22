import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hedySessions } from "@/db/schema";
import { importSingleSession } from "@/lib/hedy/import";

/**
 * Admin-Endpoint: Re-rendert alle Hedy-Sessions (holt Bundle neu,
 * baut Summary neu). Nuetzlich nach Format-Fixes. Behaelt Lead-Zuordnung.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { role?: string };
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const limit = Number(body?.limit) || 50;
  const offset = Number(body?.offset) || 0;

  const rows = db.select().from(hedySessions).limit(limit).offset(offset).all();

  const results: Array<{ sessionId: string; status: string; error?: string }> = [];
  for (const row of rows) {
    try {
      // force=true + explicitLeadId erhaelt bestehende Lead-Zuordnung
      const r = await importSingleSession(row.sessionId, {
        force: true,
        explicitLeadId: row.leadId ?? undefined,
      });
      results.push({ sessionId: row.sessionId, status: r.status, error: r.error });
    } catch (err) {
      results.push({ sessionId: row.sessionId, status: "error", error: (err as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}
