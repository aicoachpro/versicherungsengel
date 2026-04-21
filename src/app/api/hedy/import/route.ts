import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importSingleSession, runImport } from "@/lib/hedy/import";
import { HedyApiError } from "@/lib/hedy/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.sessionId) {
      const result = await importSingleSession(String(body.sessionId), {
        force: Boolean(body.force),
        explicitLeadId: body.leadId ? Number(body.leadId) : undefined,
      });
      return NextResponse.json({ ok: true, result });
    }

    const result = await runImport({ limit: body?.limit ? Number(body.limit) : 50 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof HedyApiError ? err.message : (err as Error).message;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
