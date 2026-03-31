import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { or, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      phase: leads.phase,
      termin: leads.termin,
      folgetermin: leads.folgetermin,
    })
    .from(leads)
    .where(or(isNotNull(leads.termin), isNotNull(leads.folgetermin)))
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
        phase: lead.phase,
      });
    }
    return items;
  });

  return NextResponse.json(events);
}
