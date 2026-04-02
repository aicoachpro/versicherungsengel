import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getBranding } from "@/lib/branding";

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const notGenehmigtReklamiert = sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const now = new Date();
  const month = parseInt(params.get("month") || String(now.getMonth() + 1));
  const year = parseInt(params.get("year") || String(now.getFullYear()));

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));

  const totalLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(baseFilter).get();
  const wonLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), baseFilter)).get();
  const totalRevenue = db.select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), baseFilter)).get();
  const totalCosts = db.select({ total: sql<number>`coalesce(sum(${leads.terminKosten}), 0)` }).from(leads).where(baseFilter).get();

  const conversionRate = totalLeads?.count && totalLeads.count > 0
    ? ((wonLeads?.count || 0) / totalLeads.count * 100).toFixed(1)
    : "0";

  const roi = totalCosts?.total && totalCosts.total > 0
    ? (((totalRevenue?.total || 0) - totalCosts.total) / totalCosts.total * 100).toFixed(1)
    : "0";

  // Pipeline-Verteilung
  const phases = ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt", "Abgeschlossen", "Verloren"] as const;
  const pipelineRows = phases.map((phase) => {
    const r = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, phase), baseFilter)).get();
    return `| ${phase} | ${r?.count || 0} |`;
  }).join("\n");

  // Top-Branchen
  const branchen = db.select({
    branche: sql<string>`coalesce(${leads.branche}, 'Nicht angegeben')`,
    count: sql<number>`count(*)`,
  }).from(leads).where(baseFilter).groupBy(sql`coalesce(${leads.branche}, 'Nicht angegeben')`).orderBy(sql`count(*) DESC`).limit(5).all();

  const branchenRows = branchen.map((b) => `| ${b.branche} | ${b.count} |`).join("\n");

  const monthName = MONTH_NAMES[month - 1];
  const dateStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const b = getBranding();

  const markdown = `---
tags: [sales-hub, monatsreport, ${year}]
date: ${year}-${String(month).padStart(2, "0")}-01
created: ${new Date().toISOString().split("T")[0]}
---

# Monatsauswertung ${monthName} ${year}

> Erstellt am ${dateStr} aus ${b.companyName}

## KPIs

| Kennzahl | Wert |
|----------|------|
| Neue Leads | ${totalLeads?.count || 0} |
| Abgeschlossen | ${wonLeads?.count || 0} |
| Conversion Rate | ${conversionRate}% |
| Umsatz | ${(totalRevenue?.total || 0).toLocaleString("de-DE")} € |
| Terminkosten | ${(totalCosts?.total || 0).toLocaleString("de-DE")} € |
| ROI | ${roi}% |

## Pipeline-Verteilung

| Phase | Anzahl |
|-------|--------|
${pipelineRows}

## Top-Branchen

| Branche | Leads |
|---------|-------|
${branchenRows}

---
*Automatisch generiert von [[${b.companyName}]]*
`;

  const filename = `Monatsreport_${year}-${String(month).padStart(2, "0")}_${monthName}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
