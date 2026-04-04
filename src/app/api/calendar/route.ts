import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { or, isNotNull, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as { role?: string })?.role || "user";
  const currentUserId = session.user?.id ? parseInt(session.user.id) : null;
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("showAll");

  const isAdmin = userRole === "admin";
  const shouldFilter = !isAdmin || showAll === "0";

  const hasTermin = or(isNotNull(leads.termin), isNotNull(leads.folgetermin));
  const userFilter = shouldFilter && currentUserId !== null
    ? sql`(${leads.assignedTo} = ${currentUserId} OR ${leads.assignedTo} IS NULL)`
    : undefined;

  const result = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      phase: leads.phase,
      termin: leads.termin,
      folgetermin: leads.folgetermin,
      folgeterminTyp: leads.folgeterminTyp,
    })
    .from(leads)
    .where(and(hasTermin, userFilter))
    .all();

  const events = result.flatMap((lead) => {
    const items = [];
    if (lead.termin) {
      items.push({
        id: `termin-${lead.id}`,
        leadId: lead.id,
        title: lead.name,
        ansprechpartner: lead.ansprechpartner,
        date: lead.termin,
        type: "Termin" as const,
        phase: lead.phase,
      });
    }
    if (lead.folgetermin) {
      items.push({
        id: `folgetermin-${lead.id}`,
        leadId: lead.id,
        title: lead.name,
        ansprechpartner: lead.ansprechpartner,
        date: lead.folgetermin,
        type: "Folgetermin" as const,
        folgeterminTyp: lead.folgeterminTyp || "Nachfassen",
        phase: lead.phase,
      });
    }
    return items;
  });

  return NextResponse.json(events);
}
