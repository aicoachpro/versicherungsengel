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
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const result = db
    .select({
      total: sql<number>`count(*)`,
      reklamiert: sql<number>`sum(CASE WHEN ${leads.reklamationStatus} = 'genehmigt' THEN 1 ELSE 0 END)`,
    })
    .from(leads)
    .where(sql`strftime('%Y-%m', ${leads.eingangsdatum}) = ${currentMonth}`)
    .get();

  const total = result?.total || 0;
  const reklamiert = result?.reklamiert || 0;

  return { budget, total, reklamiert, netto: total - reklamiert };
}

function getKpis(range: DateRange) {
  const filter = dateFilter(range);
  const baseFilter = filter ? and(notGenehmigtReklamiert, filter) : notGenehmigtReklamiert;

  const openLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')`, baseFilter))
    .get();

  const totalLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(baseFilter)
    .get();

  const wonLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.phase, "Abgeschlossen"), baseFilter))
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

  const conversionRate =
    totalLeads?.count && totalLeads.count > 0
      ? ((wonLeads?.count || 0) / totalLeads.count) * 100
      : 0;

  const roi =
    totalCosts?.total && totalCosts.total > 0
      ? (((totalRevenue?.total || 0) - totalCosts.total) / totalCosts.total) * 100
      : 0;

  return {
    newLeads: totalLeads?.count || 0,
    openLeads: openLeads?.count || 0,
    conversionRate: Math.round(conversionRate * 10) / 10,
    revenue: totalRevenue?.total || 0,
    costs: totalCosts?.total || 0,
    roi: Math.round(roi * 10) / 10,
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
  const leadBudget = getLeadBudget();
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
          newLeads={kpis.newLeads}
          openLeads={kpis.openLeads}
          conversionRate={kpis.conversionRate}
          revenue={kpis.revenue}
          costs={kpis.costs}
          roi={kpis.roi}
          leadBudget={leadBudget}
        />
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
