import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { writeToVault } from "@/lib/vault-writer";

const notGenehmigtReklamiert = sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function queryRange(from: string, to: string) {
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));

  const totalLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(baseFilter).get();
  const wonLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), baseFilter)).get();
  const totalRevenue = db.select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), baseFilter)).get();
  const totalCosts = db.select({ total: sql<number>`coalesce(sum(${leads.terminKosten}), 0)` }).from(leads).where(baseFilter).get();

  const total = totalLeads?.count || 0;
  const won = wonLeads?.count || 0;
  const revenue = totalRevenue?.total || 0;
  const costs = totalCosts?.total || 0;
  const conversion = total > 0 ? (won / total * 100) : 0;
  const roi = costs > 0 ? ((revenue - costs) / costs * 100) : 0;

  return { total, won, revenue, costs, conversion, roi };
}

function trend(current: number, previous: number): string {
  if (previous === 0) return "";
  const diff = ((current - previous) / previous * 100).toFixed(0);
  return current >= previous ? ` ↑${diff}%` : ` ↓${diff}%`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const b = getBranding();

  // Current week: Monday to Sunday
  const dayOfWeek = now.getDay() || 7; // 1=Mon, 7=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = monday.toISOString().split("T")[0];
  const to = sunday.toISOString().split("T")[0] + "T23:59:59";

  // Previous week
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  const prevFrom = prevMonday.toISOString().split("T")[0];
  const prevTo = prevSunday.toISOString().split("T")[0] + "T23:59:59";

  const cur = queryRange(from, to);
  const prev = queryRange(prevFrom, prevTo);

  const kw = getWeekNumber(monday);
  const year = monday.getFullYear();

  // Top activities this week
  const weekActivities = db.select({
    leadName: leads.name,
    kontaktart: activities.kontaktart,
    notiz: activities.notiz,
    datum: activities.datum,
  })
    .from(activities)
    .innerJoin(leads, eq(activities.leadId, leads.id))
    .where(and(gte(activities.datum, from), lte(activities.datum, to)))
    .orderBy(sql`${activities.datum} DESC`)
    .limit(10)
    .all();

  const activityRows = weekActivities.length > 0
    ? weekActivities.map((a) => `| ${a.datum} | ${a.leadName} | ${a.kontaktart} | ${(a.notiz || "").slice(0, 50)} |`).join("\n")
    : "| — | Keine Aktivitäten | — | — |";

  // Follow-ups next week
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  const nextFrom = nextMonday.toISOString().split("T")[0];
  const nextTo = nextSunday.toISOString().split("T")[0] + "T23:59:59";

  const upcoming = db.select({
    name: leads.name,
    folgetermin: leads.folgetermin,
    folgeterminTyp: leads.folgeterminTyp,
    phase: leads.phase,
  })
    .from(leads)
    .where(and(
      notGenehmigtReklamiert,
      sql`${leads.folgetermin} IS NOT NULL`,
      gte(leads.folgetermin, nextFrom),
      lte(leads.folgetermin, nextTo),
    ))
    .orderBy(leads.folgetermin)
    .all();

  const upcomingRows = upcoming.length > 0
    ? upcoming.map((l) => `| ${l.folgetermin} | ${l.name} | ${l.folgeterminTyp || "—"} | ${l.phase} |`).join("\n")
    : "| — | Keine Termine | — | — |";

  // Pipeline snapshot
  const phases = ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt", "Abgeschlossen", "Verloren"] as const;
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));
  const pipelineRows = phases.map((phase) => {
    const r = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, phase), baseFilter)).get();
    return `| ${phase} | ${r?.count || 0} |`;
  }).join("\n");

  const isoDate = now.toISOString().split("T")[0];
  const dateStr = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Month name for backlink
  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const monthName = monthNames[monday.getMonth()];

  const markdown = `---
tags:
  - sales-hub
  - wochenreport
  - "${year}"
  - "KW-${String(kw).padStart(2, "0")}"
date: ${from}
created: ${isoDate}
type: wochenreport
kw: ${kw}
leads: ${cur.total}
umsatz: ${cur.revenue}
conversion: ${cur.conversion.toFixed(1)}
---

# Wochenreport KW ${kw} / ${year}

> ${from} bis ${sunday.toISOString().split("T")[0]} — erstellt am ${dateStr}
> Monatsreport: [[${from.slice(0, 7)}-01-versicherungsengel-monatsreport|${monthName} ${year}]]

## KPIs

| Kennzahl | KW ${kw} | KW ${kw - 1 > 0 ? kw - 1 : 52} | Trend |
|----------|---------|---------|-------|
| Neue Leads | ${cur.total} | ${prev.total} | ${trend(cur.total, prev.total)} |
| Abgeschlossen | ${cur.won} | ${prev.won} | ${trend(cur.won, prev.won)} |
| Conversion | ${cur.conversion.toFixed(1)}% | ${prev.conversion.toFixed(1)}% | ${trend(cur.conversion, prev.conversion)} |
| Umsatz | ${cur.revenue.toLocaleString("de-DE")} € | ${prev.revenue.toLocaleString("de-DE")} € | ${trend(cur.revenue, prev.revenue)} |
| Kosten | ${cur.costs.toLocaleString("de-DE")} € | ${prev.costs.toLocaleString("de-DE")} € | |
| ROI | ${cur.roi.toFixed(1)}% | ${prev.roi.toFixed(1)}% | ${trend(cur.roi, prev.roi)} |

## Top-Aktivitäten

| Datum | Lead | Kontaktart | Notiz |
|-------|------|------------|-------|
${activityRows}

## Termine nächste Woche

| Datum | Lead | Typ | Phase |
|-------|------|-----|-------|
${upcomingRows}

## Pipeline diese Woche

| Phase | Anzahl |
|-------|--------|
${pipelineRows}

---
*Automatisch generiert aus ${b.companyName}*
`;

  const filename = `${isoDate}-versicherungsengel-wochenreport.md`;

  const written = writeToVault(filename, markdown);

  if (written) {
    return NextResponse.json({ ok: true, path: written, filename });
  }

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
