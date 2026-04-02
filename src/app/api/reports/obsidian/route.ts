import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { writeToVault } from "@/lib/vault-writer";

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const notGenehmigtReklamiert = sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

function queryMonth(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
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

  const params = req.nextUrl.searchParams;
  const now = new Date();
  const month = parseInt(params.get("month") || String(now.getMonth() + 1));
  const year = parseInt(params.get("year") || String(now.getFullYear()));
  const b = getBranding();

  // Current + previous month
  const cur = queryMonth(month, year);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prev = queryMonth(prevMonth, prevYear);

  // Pipeline distribution
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));

  const phases = ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt", "Abgeschlossen", "Verloren"] as const;
  const pipelineRows = phases.map((phase) => {
    const r = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, phase), baseFilter)).get();
    return `| ${phase} | ${r?.count || 0} |`;
  }).join("\n");

  // Top branches
  const branchen = db.select({
    branche: sql<string>`coalesce(${leads.branche}, 'Nicht angegeben')`,
    count: sql<number>`count(*)`,
  }).from(leads).where(baseFilter).groupBy(sql`coalesce(${leads.branche}, 'Nicht angegeben')`).orderBy(sql`count(*) DESC`).limit(5).all();
  const branchenRows = branchen.map((b) => `| ${b.branche} | ${b.count} |`).join("\n");

  // Weekly breakdown
  const weekRows: string[] = [];
  const firstDay = new Date(year, month - 1, 1);
  let weekStart = new Date(firstDay);
  let weekNum = 1;
  while (weekStart.getMonth() === month - 1) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd.getMonth() !== month - 1) {
      weekEnd.setDate(new Date(year, month, 0).getDate());
      weekEnd.setMonth(month - 1);
    }
    const wFrom = weekStart.toISOString().split("T")[0];
    const wTo = weekEnd.toISOString().split("T")[0] + "T23:59:59";
    const wFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, wFrom), lte(leads.eingangsdatum, wTo));
    const wTotal = db.select({ count: sql<number>`count(*)` }).from(leads).where(wFilter).get();
    const wWon = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), wFilter)).get();
    const wRev = db.select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), wFilter)).get();
    weekRows.push(`| KW ${weekNum} (${wFrom.slice(5)}) | ${wTotal?.count || 0} | ${wWon?.count || 0} | ${(wRev?.total || 0).toLocaleString("de-DE")} € |`);
    weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() + 1);
    weekNum++;
  }

  const monthName = MONTH_NAMES[month - 1];
  const prevMonthName = MONTH_NAMES[prevMonth - 1];
  const isoDate = now.toISOString().split("T")[0];
  const monthFirstDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const dateStr = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const markdown = `---
tags:
  - sales-hub
  - monatsreport
  - "${year}"
  - "${monthName.toLowerCase()}"
date: ${year}-${String(month).padStart(2, "0")}-01
created: ${isoDate}
type: monatsreport
leads: ${cur.total}
umsatz: ${cur.revenue}
conversion: ${cur.conversion.toFixed(1)}
---

# Monatsauswertung ${monthName} ${year}

> Erstellt am ${dateStr} aus ${b.companyName}

## KPIs

| Kennzahl | ${monthName} | ${prevMonthName} | Trend |
|----------|-------------|-----------------|-------|
| Neue Leads | ${cur.total} | ${prev.total} | ${trend(cur.total, prev.total)} |
| Abgeschlossen | ${cur.won} | ${prev.won} | ${trend(cur.won, prev.won)} |
| Conversion Rate | ${cur.conversion.toFixed(1)}% | ${prev.conversion.toFixed(1)}% | ${trend(cur.conversion, prev.conversion)} |
| Umsatz | ${cur.revenue.toLocaleString("de-DE")} € | ${prev.revenue.toLocaleString("de-DE")} € | ${trend(cur.revenue, prev.revenue)} |
| Terminkosten | ${cur.costs.toLocaleString("de-DE")} € | ${prev.costs.toLocaleString("de-DE")} € | |
| ROI | ${cur.roi.toFixed(1)}% | ${prev.roi.toFixed(1)}% | ${trend(cur.roi, prev.roi)} |

## Wochenweise Aufschlüsselung

| Woche | Leads | Abschlüsse | Umsatz |
|-------|-------|------------|--------|
${weekRows.join("\n")}

## Pipeline-Verteilung

| Phase | Anzahl |
|-------|--------|
${pipelineRows}

## Top-Branchen

| Branche | Leads |
|---------|-------|
${branchenRows}

---
*Automatisch generiert aus ${b.companyName}*
`;

  const filename = `${monthFirstDate}-versicherungsengel-monatsreport.md`;

  // Write to vault if configured
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
