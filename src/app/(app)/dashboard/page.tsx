export const dynamic = "force-dynamic";

import { db } from "@/db";
import { leads, insurances } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { getSetting } from "@/lib/settings";
import { Header } from "@/components/layout/header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { GewerbeartChart } from "@/components/dashboard/gewerbeart-chart";
import { LeadTrendChart } from "@/components/dashboard/lead-trend-chart";
import { ReportButton } from "@/components/dashboard/report-button";
import { MonthFilter } from "@/components/dashboard/month-filter";
import { SmartInsights, type Insight } from "@/components/dashboard/smart-insights";

type DateRange = { from: string; to: string } | null;

function getDateRange(month?: number, year?: number): DateRange {
  if (!month || !year) return null;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
  return { from, to };
}

function dateFilter(range: DateRange) {
  if (!range) return undefined;
  return and(gte(leads.eingangsdatum, range.from), lte(leads.eingangsdatum, range.to));
}

// Genehmigte Reklamationen aus allen KPIs ausschließen — Kosten wurden gutgeschrieben
const notGenehmigtReklamiert = sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

function getLeadBudget() {
  const budget = parseInt(getSetting("company.leadBudget") || "10", 10);

  const result = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${leads.eingangsdatum})`,
      total: sql<number>`count(*)`,
      reklamiert: sql<number>`sum(CASE WHEN ${leads.reklamationStatus} = 'genehmigt' THEN 1 ELSE 0 END)`,
    })
    .from(leads)
    .groupBy(sql`strftime('%Y-%m', ${leads.eingangsdatum})`)
    .orderBy(sql`strftime('%Y-%m', ${leads.eingangsdatum})`)
    .all();

  const months = result
    .filter((r) => r.month != null)
    .map((r) => ({
      month: r.month,
      total: r.total,
      reklamiert: r.reklamiert || 0,
      netto: r.total - (r.reklamiert || 0),
    }));

  return { budget, months };
}

function getWonLeadsCount(range: DateRange) {
  const filter = dateFilter(range);
  const baseFilter = filter
    ? and(sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`, filter)
    : sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.phase, "Abgeschlossen"), baseFilter))
    .get();

  return result?.count || 0;
}

function getKpis(range: DateRange) {
  const filter = dateFilter(range);
  const baseFilter = filter ? and(notGenehmigtReklamiert, filter) : notGenehmigtReklamiert;

  const openLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')`, baseFilter))
    .get();

  const totalRevenue = db
    .select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` })
    .from(leads)
    .where(and(eq(leads.phase, "Abgeschlossen"), baseFilter))
    .get();

  const totalCosts = db
    .select({ total: sql<number>`coalesce(sum(${leads.terminKosten}), 0)` })
    .from(leads)
    .where(baseFilter)
    .get();

  const revenue = totalRevenue?.total || 0;
  const costs = totalCosts?.total || 0;
  const roi = costs > 0 ? Math.round(((revenue - costs) / costs) * 1000) / 10 : 0;

  return {
    openLeads: openLeads?.count || 0,
    revenue,
    costs,
    roi,
  };
}

function getPipelineData(range: DateRange) {
  const phases = [
    "Termin eingegangen",
    "Termin stattgefunden",
    "Follow-up",
    "Angebot erstellt",
    "Abgeschlossen",
    "Verloren",
  ] as const;
  const filter = dateFilter(range);
  const baseFilter = filter ? and(notGenehmigtReklamiert, filter) : notGenehmigtReklamiert;

  return phases.map((phase) => {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.phase, phase), baseFilter))
      .get();
    return { phase, count: result?.count || 0 };
  });
}

function getRevenueByMonth() {
  const result = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${leads.createdAt})`,
      revenue: sql<number>`coalesce(sum(${leads.umsatz}), 0)`,
      costs: sql<number>`coalesce(sum(${leads.terminKosten}), 0)`,
    })
    .from(leads)
    .where(notGenehmigtReklamiert)
    .groupBy(sql`strftime('%Y-%m', ${leads.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${leads.createdAt})`)
    .all();

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mär", "04": "Apr",
    "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez",
  };

  return result
    .filter((r) => r.month != null)
    .map((r) => ({
      month: monthNames[r.month.split("-")[1]] || r.month,
      rawMonth: r.month,
      umsatz: r.revenue,
      kosten: r.costs,
      ueberschuss: r.revenue - r.costs,
    }));
}

function getGewerbeartData(range: DateRange) {
  const filter = dateFilter(range);
  const baseFilter = filter ? and(notGenehmigtReklamiert, filter) : notGenehmigtReklamiert;
  const result = db
    .select({
      gewerbeart: sql<string>`coalesce(${leads.gewerbeart}, 'Nicht angegeben')`,
      anzahl: sql<number>`count(*)`,
      umsatz: sql<number>`coalesce(sum(${leads.umsatz}), 0)`,
      kosten: sql<number>`coalesce(sum(${leads.terminKosten}), 0)`,
    })
    .from(leads)
    .where(baseFilter)
    .groupBy(sql`coalesce(${leads.gewerbeart}, 'Nicht angegeben')`)
    .all();

  return result.map((r) => ({
    gewerbeart:
      r.gewerbeart === "hauptberuflich"
        ? "Hauptberuflich"
        : r.gewerbeart === "nebenberuflich"
          ? "Nebenberuflich"
          : r.gewerbeart,
    anzahl: r.anzahl,
    umsatz: r.umsatz,
    kosten: r.kosten,
  }));
}

function getUpcomingAppointments() {
  const now = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM für exakten Zeitvergleich
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] + "T23:59";

  const notReklamiert = sql`${leads.reklamiertAt} IS NULL`;

  // Ersttermine
  const termine = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      termin: leads.termin,
      phase: leads.phase,
    })
    .from(leads)
    .where(and(gte(leads.termin, now), lte(leads.termin, weekLater), notReklamiert))
    .all()
    .map((t) => ({ ...t, typ: "Termin" as const }));

  // Folgetermine
  const folgetermine = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      termin: leads.folgetermin,
      phase: leads.phase,
      folgeterminTyp: leads.folgeterminTyp,
    })
    .from(leads)
    .where(and(gte(leads.folgetermin, now), lte(leads.folgetermin, weekLater), notReklamiert))
    .all()
    .map((t) => ({ ...t, typ: "Folgetermin" as const }));

  return [...termine, ...folgetermine]
    .sort((a, b) => (a.termin || "").localeCompare(b.termin || ""))
    .slice(0, 5);
}

function getRecentActivity() {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      phase: leads.phase,
      updatedAt: leads.updatedAt,
      reklamiertAt: leads.reklamiertAt,
    })
    .from(leads)
    .where(sql`${leads.reklamiertAt} IS NULL`)
    .orderBy(sql`${leads.updatedAt} DESC`)
    .limit(8)
    .all();
}

function getSmartInsights(leadBudget: ReturnType<typeof getLeadBudget>): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const nowIso = now.toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Leads ohne Aktivitaet seit >7 Tagen (nicht abgeschlossen/verloren, nicht reklamiert)
  const staleLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')
        AND ${leads.reklamiertAt} IS NULL
        AND ${leads.updatedAt} < ${sevenDaysAgo}`
    )
    .get();

  if (staleLeads && staleLeads.count > 0) {
    insights.push({
      type: "warning",
      icon: "clock",
      text: `${staleLeads.count} Lead${staleLeads.count > 1 ? "s" : ""} warten seit \u00fcber 7 Tagen auf Kontakt`,
      href: "/pipeline",
    });
  }

  // Ueberfaellige Folgetermine
  const overdueFollowups = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      sql`${leads.folgetermin} IS NOT NULL
        AND ${leads.folgetermin} < ${nowIso}
        AND ${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')
        AND ${leads.reklamiertAt} IS NULL`
    )
    .get();

  if (overdueFollowups && overdueFollowups.count > 0) {
    insights.push({
      type: "danger",
      icon: "clipboard",
      text: `${overdueFollowups.count} \u00fcberf\u00e4llige${overdueFollowups.count > 1 ? " Folgetermine" : "r Folgetermin"}`,
      href: "/pipeline",
    });
  }

  // Restliches Budget diesen Monat
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = leadBudget.months.find((m) => m.month === currentMonthKey);
  const nettoThisMonth = currentMonth?.netto ?? 0;
  const remaining = leadBudget.budget - nettoThisMonth;

  if (remaining > 0) {
    insights.push({
      type: "info",
      icon: "package",
      text: `Noch ${remaining} Lead${remaining > 1 ? "s" : ""} im Budget f\u00fcr diesen Monat`,
    });
  }

  // Umsatz-Vergleich mit Vormonat
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const revenueThisMonth = db
    .select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` })
    .from(leads)
    .where(
      sql`${leads.phase} = 'Abgeschlossen'
        AND strftime('%Y-%m', ${leads.eingangsdatum}) = ${currentMonthKey}
        AND (${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`
    )
    .get();

  const revenuePrevMonth = db
    .select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` })
    .from(leads)
    .where(
      sql`${leads.phase} = 'Abgeschlossen'
        AND strftime('%Y-%m', ${leads.eingangsdatum}) = ${prevMonthKey}
        AND (${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`
    )
    .get();

  const revThis = revenueThisMonth?.total || 0;
  const revPrev = revenuePrevMonth?.total || 0;

  if (revPrev > 0 && revThis > revPrev) {
    const pct = Math.round(((revThis - revPrev) / revPrev) * 100);
    insights.push({
      type: "success",
      icon: "trending",
      text: `Umsatz ${pct}% \u00fcber Vormonat`,
    });
  }

  // Bester Monat (nur wenn 2+ Monate mit Umsatz vorhanden)
  const revenueByMonth = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${leads.eingangsdatum})`,
      revenue: sql<number>`coalesce(sum(${leads.umsatz}), 0)`,
    })
    .from(leads)
    .where(
      sql`${leads.phase} = 'Abgeschlossen'
        AND (${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`
    )
    .groupBy(sql`strftime('%Y-%m', ${leads.eingangsdatum})`)
    .all()
    .filter((r) => r.month != null && r.revenue > 0);

  if (revenueByMonth.length >= 2) {
    const best = revenueByMonth.reduce((a, b) => (b.revenue > a.revenue ? b : a));
    const monthNames: Record<string, string> = {
      "01": "Januar", "02": "Februar", "03": "M\u00e4rz", "04": "April",
      "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
      "09": "September", "10": "Oktober", "11": "November", "12": "Dezember",
    };
    const monthName = monthNames[best.month.split("-")[1]] || best.month;
    insights.push({
      type: "success",
      icon: "trending",
      text: `Dein bester Monat: ${monthName} mit ${best.revenue}\u20ac Umsatz`,
    });
  }

  // Conversion Hint: Leads im Angebotsstatus
  const angebotLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      sql`${leads.phase} = 'Angebot erstellt'
        AND ${leads.reklamiertAt} IS NULL`
    )
    .get();

  if (angebotLeads && angebotLeads.count > 0) {
    insights.push({
      type: "info",
      icon: "clipboard",
      text: `${angebotLeads.count} Lead${angebotLeads.count > 1 ? "s" : ""} im Angebotsstatus \u2014 dranbleiben!`,
      href: "/pipeline",
    });
  }

  // Winning Streak: 2+ Abschl\u00fcsse diesen Monat
  const winsThisMonth = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      sql`${leads.phase} = 'Abgeschlossen'
        AND strftime('%Y-%m', ${leads.eingangsdatum}) = ${currentMonthKey}
        AND (${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`
    )
    .get();

  if (winsThisMonth && winsThisMonth.count >= 2) {
    insights.push({
      type: "success",
      icon: "trending",
      text: `Schon ${winsThisMonth.count} Abschl\u00fcsse diesen Monat \u2014 weiter so!`,
    });
  }

  // Priorisierung: danger > warning > success > info, max 4
  const priorityOrder: Record<Insight["type"], number> = { danger: 0, warning: 1, success: 2, info: 3 };
  insights.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);

  return insights.slice(0, 4);
}

function getLeadTrend() {
  // Leads pro Woche der letzten 8 Wochen
  const result = db
    .select({
      week: sql<string>`strftime('%Y-W%W', ${leads.createdAt})`,
      weekStart: sql<string>`date(${leads.createdAt}, 'weekday 1', '-7 days')`,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(sql`${leads.createdAt} >= date('now', '-56 days')`)
    .groupBy(sql`strftime('%Y-W%W', ${leads.createdAt})`)
    .orderBy(sql`strftime('%Y-W%W', ${leads.createdAt})`)
    .all();

  return result.map((r) => {
    const d = new Date(r.weekStart);
    const label = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.`;
    return { week: label, leads: r.count };
  });
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; all?: string }> }) {
  const params = await searchParams;
  const now = new Date();
  const hasFilter = params.month && params.year;
  const isAll = !hasFilter || params.all === "1";
  const month = isAll ? undefined : parseInt(params.month!);
  const year = isAll ? undefined : parseInt(params.year!);
  const range = month && year ? getDateRange(month, year) : null;

  const kpis = getKpis(range);
  const wonLeads = getWonLeadsCount(range);
  const leadBudget = getLeadBudget();
  const insights = getSmartInsights(leadBudget);
  const pipelineData = getPipelineData(range);
  const revenueData = getRevenueByMonth();
  const gewerbeartData = getGewerbeartData(range);
  const leadTrend = getLeadTrend();
  const appointments = getUpcomingAppointments();
  const recentActivity = getRecentActivity();

  return (
    <div className="flex flex-col overflow-x-hidden">
      <Header title="Dashboard" actions={<div className="flex items-center gap-2"><MonthFilter /><ReportButton /></div>} />
      <div className="flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 overflow-x-hidden">
        <KpiCards
          wonLeads={wonLeads}
          openLeads={kpis.openLeads}
          revenue={kpis.revenue}
          costs={kpis.costs}
          roi={kpis.roi}
          leadBudget={leadBudget}
        />
        <SmartInsights insights={insights} />
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <RevenueChart data={revenueData} />
          <PipelineFunnel data={pipelineData} />
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <LeadTrendChart data={leadTrend} />
          <GewerbeartChart data={gewerbeartData} />
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <UpcomingAppointments appointments={appointments} />
          <RecentActivity activities={recentActivity} />
        </div>
      </div>
    </div>
  );
}
