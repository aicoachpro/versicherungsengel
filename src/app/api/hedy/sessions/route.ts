import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { hedySessions, leads } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status"); // optional
  const leadIdParam = req.nextUrl.searchParams.get("leadId");

  const base = db
    .select({
      id: hedySessions.id,
      sessionId: hedySessions.sessionId,
      title: hedySessions.title,
      startedAt: hedySessions.startedAt,
      endedAt: hedySessions.endedAt,
      participants: hedySessions.participants,
      summary: hedySessions.summary,
      leadId: hedySessions.leadId,
      activityId: hedySessions.activityId,
      matchStatus: hedySessions.matchStatus,
      matchConfidence: hedySessions.matchConfidence,
      matchReason: hedySessions.matchReason,
      errorMessage: hedySessions.errorMessage,
      importedAt: hedySessions.importedAt,
      leadName: leads.name,
    })
    .from(hedySessions)
    .leftJoin(leads, eq(hedySessions.leadId, leads.id))
    .orderBy(desc(hedySessions.importedAt))
    .limit(100);

  type MatchStatus = typeof hedySessions.$inferSelect.matchStatus;
  let rows;
  if (status) {
    rows = base.where(eq(hedySessions.matchStatus, status as MatchStatus)).all();
  } else if (leadIdParam) {
    rows = base.where(eq(hedySessions.leadId, Number(leadIdParam))).all();
  } else {
    rows = base.all();
  }

  const parsed = rows.map((r) => ({
    ...r,
    participants: r.participants ? safeJson(r.participants) : null,
  }));
  return NextResponse.json(parsed);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
