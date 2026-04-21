import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assignSessionToLead, ignoreSession } from "@/lib/hedy/import";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "assign") {
    const leadId = Number(body.leadId);
    if (!leadId) return NextResponse.json({ error: "leadId fehlt" }, { status: 400 });
    const result = assignSessionToLead(sessionId, leadId);
    return NextResponse.json({ ok: true, result });
  }

  if (action === "ignore") {
    const result = ignoreSession(sessionId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: "unbekannte Aktion (assign|ignore)" }, { status: 400 });
}
