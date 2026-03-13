export const dynamic = "force-dynamic";

import { db } from "@/db";
import { leads, insurances } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { Header } from "@/components/layout/header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { RecentActivity } from "@/components/dashboard/recent-activity";

function getKpis() {
  const openLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')`
    )
    .get();

  const totalLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .get();

  const wonLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.phase, "Abgeschlossen"))
    .get();

  const totalRevenue = db
    .select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` })
    .from(leads)
    .where(eq(leads.phase, "Abgeschlossen"))
    .get();

  const totalCosts = db
    .select({ total: sql<number>`coalesce(sum(${leads.terminKosten}), 0)` })
    .from(leads)
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
    openLeads: openLeads?.count || 0,
    conversionRate: Math.round(conversionRate * 10) / 10,
    revenue: totalRevenue?.total || 0,
    roi: Math.round(roi * 10) / 10,
  };
}

function getPipelineData() {
  const phases = [
    "Termin eingegangen",
    "Termin stattgefunden",
    "Follow-up",
    "Angebot erstellt",
    "Abgeschlossen",
    "Verloren",
  ] as const;

  return phases.map((phase) => {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.phase, phase))
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
    .groupBy(sql`strftime('%Y-%m', ${leads.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${leads.createdAt})`)
    .limit(6)
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
      umsatz: r.revenue,
      kosten: r.costs,
    }));
}

function getUpcomingAppointments() {
  const now = new Date().toISOString().split("T")[0];
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      termin: leads.termin,
      phase: leads.phase,
    })
    .from(leads)
    .where(
      and(
        gte(leads.termin, now),
        lte(leads.termin, weekLater)
      )
    )
    .orderBy(leads.termin)
    .limit(5)
    .all();
}

function getRecentActivity() {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      phase: leads.phase,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .orderBy(sql`${leads.updatedAt} DESC`)
    .limit(8)
    .all();
}

export default function DashboardPage() {
  const kpis = getKpis();
  const pipelineData = getPipelineData();
  const revenueData = getRevenueByMonth();
  const appointments = getUpcomingAppointments();
  const recentActivity = getRecentActivity();

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />
      <div className="flex-1 space-y-6 p-6">
        <KpiCards
          openLeads={kpis.openLeads}
          conversionRate={kpis.conversionRate}
          revenue={kpis.revenue}
          roi={kpis.roi}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueChart data={revenueData} />
          <PipelineFunnel data={pipelineData} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <UpcomingAppointments appointments={appointments} />
          <RecentActivity activities={recentActivity} />
        </div>
      </div>
    </div>
  );
}
