export const dynamic = "force-dynamic";

import { db } from "@/db";
import { leads, insurances, leadProviders, provisions } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { getSetting } from "@/lib/settings";
import { auth } from "@/lib/auth";

// Lead-Provider aus DB lesen (graceful fallback wenn Tabelle noch nicht existiert)
function getActiveProviders() {
  try {
    return db
      .select()
      .from(leadProviders)
      .where(eq(leadProviders.active, true))
      .all();
  } catch {
    // Tabelle existiert noch nicht — Fallback auf Settings
    return [];
  }
}
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
import { UserFilter } from "@/components/dashboard/user-filter";
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

function assignedFilter(userId: number | null) {
  if (userId === null) return undefined;
  // NULL assignedTo = unassigned = visible to everyone
  return sql`(${leads.assignedTo} = ${userId} OR ${leads.assignedTo} IS NULL)`;
}

// Genehmigte Reklamationen aus allen KPIs ausschließen — Kosten wurden gutgeschrieben
const notGenehmigtReklamiert = sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

function getLeadBudget() {
  // Versuch 1: Aus lead_providers-Tabelle aggregieren
  const providers = getActiveProviders();

  let minPerMonth: number;
  let costPerLead: number;
  let carryOverEnabled: boolean;
  let startMonth: string;

  if (providers.length > 0) {
    // Aggregation ueber alle aktiven Provider
    minPerMonth = providers.reduce((sum, p) => sum + (p.minPerMonth || 0), 0);
    // Gewichteter Durchschnitt der Kosten pro Lead (nach minPerMonth gewichtet)
    const totalWeightedCost = providers.reduce((sum, p) => sum + (p.costPerLead || 0) * (p.minPerMonth || 0), 0);
    costPerLead = minPerMonth > 0 ? Math.round(totalWeightedCost / minPerMonth) : 0;
    // carryOver = true wenn IRGENDEIN Provider es aktiviert hat
    carryOverEnabled = providers.some((p) => p.carryOver);
    // Fruehestes startMonth aller Provider
    const startMonths = providers.map((p) => p.startMonth).filter(Boolean) as string[];
    startMonth = startMonths.length > 0 ? startMonths.sort()[0] : "";
  } else {
    // Fallback: alte Settings-basierte Logik (nur wenn konfiguriert)
    const budgetStr = getSetting("company.leadBudget") || getSetting("leadProvider.minPerMonth");
    if (!budgetStr) {
      // Nichts konfiguriert — leeres Budget zurückgeben
      return { budget: 0, costPerLead: 0, months: [] };
    }
    minPerMonth = parseInt(budgetStr, 10) || 0;
    carryOverEnabled = getSetting("leadProvider.carryOver") === "true";
    startMonth = getSetting("leadProvider.startMonth");
    costPerLead = parseInt(getSetting("leadProvider.costPerLead") || "0", 10);
  }

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

  const monthsRaw = result
    .filter((r) => r.month != null)
    .map((r) => ({
      month: r.month,
      total: r.total,
      reklamiert: r.reklamiert || 0,
      netto: r.total - (r.reklamiert || 0),
    }));

  // Build lookup
  const monthLookup = new Map(monthsRaw.map((m) => [m.month, m]));

  // Generate all months from startMonth to now
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const effectiveStart = startMonth || monthsRaw[0]?.month || currentMonthKey;

  const allMonthKeys: string[] = [];
  {
    const [sy, sm] = effectiveStart.split("-").map(Number);
    const d = new Date(sy, sm - 1, 1);
    while (d <= now) {
      allMonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
  }

  // Calculate carry-over per month
  let accumulatedCarryOver = 0;
  const monthsWithCarryOver = allMonthKeys.map((key) => {
    const data = monthLookup.get(key);
    const delivered = data?.netto ?? 0;
    const total = data?.total ?? 0;
    const reklamiert = data?.reklamiert ?? 0;

    const expected = minPerMonth + (carryOverEnabled ? accumulatedCarryOver : 0);
    const carryOverForThisMonth = carryOverEnabled ? accumulatedCarryOver : 0;
    const outstanding = Math.max(0, expected - delivered);

    // Shortfall for this month -> rolls to next
    const shortfall = Math.max(0, minPerMonth - delivered);
    if (carryOverEnabled) {
      accumulatedCarryOver = accumulatedCarryOver + shortfall;
      // If delivered more than minPerMonth, reduce carry-over
      if (delivered > minPerMonth) {
        const excess = delivered - minPerMonth;
        accumulatedCarryOver = Math.max(0, accumulatedCarryOver - excess);
      }
    }

    return {
      month: key,
      total,
      reklamiert,
      netto: delivered,
      expected,
      carryOver: carryOverForThisMonth,
      outstanding,
    };
  });

  // Also include months from data that are before startMonth
  const beforeStart = monthsRaw
    .filter((m) => m.month < effectiveStart)
    .map((m) => ({
      ...m,
      expected: minPerMonth,
      carryOver: 0,
      outstanding: Math.max(0, minPerMonth - m.netto),
    }));

  const months = [...beforeStart, ...monthsWithCarryOver];

  return { budget: minPerMonth, costPerLead, months };
}

function getWonLeadsCount(range: DateRange, userId: number | null = null) {
  const filter = dateFilter(range);
  const uFilter = assignedFilter(userId);
  const baseFilter = and(
    sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`,
    filter ?? undefined,
    uFilter ?? undefined,
  );

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.phase, "Abgeschlossen"), baseFilter))
    .get();

  return result?.count || 0;
}

function getKpis(range: DateRange, userId: number | null = null) {
  const filter = dateFilter(range);
  const uFilter = assignedFilter(userId);
  const baseFilter = and(notGenehmigtReklamiert, filter ?? undefined, uFilter ?? undefined);

  const openLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(and(sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')`, baseFilter))
    .get();

  // Umsatz = Summe aller bestaetigten Provisionen (statt leads.umsatz)
  let revenue = 0;
  try {
    const provisionFilter = and(
      eq(provisions.confirmed, true),
      userId !== null
        ? sql`${provisions.leadId} IN (SELECT id FROM leads WHERE assigned_to = ${userId} OR assigned_to IS NULL)`
        : undefined,
    );
    const totalRevenue = db
      .select({ total: sql<number>`coalesce(sum(${provisions.betrag}), 0)` })
      .from(provisions)
      .where(provisionFilter)
      .get();
    revenue = totalRevenue?.total || 0;
  } catch {
    // provisions-Tabelle existiert noch nicht — Fallback auf 0
  }

  const totalCosts = db
    .select({ total: sql<number>`coalesce(sum(${leads.terminKosten}), 0)` })
    .from(leads)
    .where(baseFilter)
    .get();
  const costs = totalCosts?.total || 0;
  const roi = costs > 0 ? Math.round(((revenue - costs) / costs) * 1000) / 10 : 0;

  return {
    openLeads: openLeads?.count || 0,
    revenue,
    costs,
    roi,
  };
}

function getPipelineData(range: DateRange, userId: number | null = null) {
  const phases = [
    "Termin eingegangen",
    "Termin stattgefunden",
    "Follow-up",
    "Angebot erstellt",
    "Abgeschlossen",
    "Verloren",
  ] as const;
  const filter = dateFilter(range);
  const uFilter = assignedFilter(userId);
  const baseFilter = and(notGenehmigtReklamiert, filter ?? undefined, uFilter ?? undefined);

  return phases.map((phase) => {
    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(and(eq(leads.phase, phase), baseFilter))
      .get();
    return { phase, count: result?.count || 0 };
  });
}

function getRevenueByMonth(userId: number | null = null) {
  const uFilter = assignedFilter(userId);
  const baseFilter = and(notGenehmigtReklamiert, uFilter ?? undefined);

  // Kosten aus leads (nach createdAt gruppiert)
  const costsResult = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${leads.createdAt})`,
      costs: sql<number>`coalesce(sum(${leads.terminKosten}), 0)`,
    })
    .from(leads)
    .where(baseFilter)
    .groupBy(sql`strftime('%Y-%m', ${leads.createdAt})`)
    .all();

  const costsByMonth = new Map(costsResult.filter((r) => r.month != null).map((r) => [r.month, r.costs]));

  // Umsatz aus bestaetigten Provisionen (nach buchungsDatum gruppiert)
  let revenueByMonth = new Map<string, number>();
  try {
    const provisionFilter = and(
      eq(provisions.confirmed, true),
      userId !== null
        ? sql`${provisions.leadId} IN (SELECT id FROM leads WHERE assigned_to = ${userId} OR assigned_to IS NULL)`
        : undefined,
    );
    const provResult = db
      .select({
        month: sql<string>`strftime('%Y-%m', ${provisions.buchungsDatum})`,
        revenue: sql<number>`coalesce(sum(${provisions.betrag}), 0)`,
      })
      .from(provisions)
      .where(provisionFilter)
      .groupBy(sql`strftime('%Y-%m', ${provisions.buchungsDatum})`)
      .all();
    revenueByMonth = new Map(provResult.filter((r) => r.month != null).map((r) => [r.month, r.revenue]));
  } catch {
    // provisions-Tabelle existiert noch nicht
  }

  // Alle Monate sammeln und mergen
  const allMonths = new Set([...costsByMonth.keys(), ...revenueByMonth.keys()]);
  const sortedMonths = [...allMonths].sort();

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mär", "04": "Apr",
    "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez",
  };

  return sortedMonths.map((m) => {
    const revenue = revenueByMonth.get(m) || 0;
    const costs = costsByMonth.get(m) || 0;
    return {
      month: monthNames[m.split("-")[1]] || m,
      rawMonth: m,
      umsatz: revenue,
      kosten: costs,
      ueberschuss: revenue - costs,
    };
  });
}

function getGewerbeartData(range: DateRange, userId: number | null = null) {
  const filter = dateFilter(range);
  const uFilter = assignedFilter(userId);
  const baseFilter = and(notGenehmigtReklamiert, filter ?? undefined, uFilter ?? undefined);
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

function getUpcomingAppointments(userId: number | null = null) {
  const now = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM für exakten Zeitvergleich
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] + "T23:59";

  const notReklamiert = sql`${leads.reklamiertAt} IS NULL`;
  const uFilter = assignedFilter(userId);

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
    .where(and(gte(leads.termin, now), lte(leads.termin, weekLater), notReklamiert, uFilter ?? undefined))
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
    .where(and(gte(leads.folgetermin, now), lte(leads.folgetermin, weekLater), notReklamiert, uFilter ?? undefined))
    .all()
    .map((t) => ({ ...t, typ: "Folgetermin" as const }));

  return [...termine, ...folgetermine]
    .sort((a, b) => (a.termin || "").localeCompare(b.termin || ""))
    .slice(0, 5);
}

function getRecentActivity(userId: number | null) {
  const uFilter = assignedFilter(userId);
  return db
    .select({
      id: leads.id,
      name: leads.name,
      phase: leads.phase,
      updatedAt: leads.updatedAt,
      reklamiertAt: leads.reklamiertAt,
    })
    .from(leads)
    .where(and(sql`${leads.reklamiertAt} IS NULL`, uFilter ?? undefined))
    .orderBy(sql`${leads.updatedAt} DESC`)
    .limit(8)
    .all();
}

function getSmartInsights(leadBudget: ReturnType<typeof getLeadBudget>, userId: number | null): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const nowIso = now.toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const uFilter = assignedFilter(userId);
  const uSql = userId !== null
    ? sql`AND (${leads.assignedTo} = ${userId} OR ${leads.assignedTo} IS NULL)`
    : sql``;

  // Leads ohne Aktivitaet seit >7 Tagen (nicht abgeschlossen/verloren, nicht reklamiert)
  const staleLeads = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')
        AND ${leads.reklamiertAt} IS NULL
        AND ${leads.updatedAt} < ${sevenDaysAgo}
        ${uSql}`
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
        AND ${leads.reklamiertAt} IS NULL
        ${uSql}`
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

  // Umsatz-Vergleich mit Vormonat (aus bestaetigten Provisionen)
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  let revThis = 0;
  let revPrev = 0;
  let revenueByMonthData: { month: string; revenue: number }[] = [];

  try {
    const provUserFilter = userId !== null
      ? sql`AND ${provisions.leadId} IN (SELECT id FROM leads WHERE assigned_to = ${userId} OR assigned_to IS NULL)`
      : sql``;

    const revenueThisMonth = db
      .select({ total: sql<number>`coalesce(sum(${provisions.betrag}), 0)` })
      .from(provisions)
      .where(
        sql`${provisions.confirmed} = 1
          AND strftime('%Y-%m', ${provisions.buchungsDatum}) = ${currentMonthKey}
          ${provUserFilter}`
      )
      .get();

    const revenuePrevMonth = db
      .select({ total: sql<number>`coalesce(sum(${provisions.betrag}), 0)` })
      .from(provisions)
      .where(
        sql`${provisions.confirmed} = 1
          AND strftime('%Y-%m', ${provisions.buchungsDatum}) = ${prevMonthKey}
          ${provUserFilter}`
      )
      .get();

    revThis = revenueThisMonth?.total || 0;
    revPrev = revenuePrevMonth?.total || 0;

    // Bester Monat
    revenueByMonthData = db
      .select({
        month: sql<string>`strftime('%Y-%m', ${provisions.buchungsDatum})`,
        revenue: sql<number>`coalesce(sum(${provisions.betrag}), 0)`,
      })
      .from(provisions)
      .where(
        sql`${provisions.confirmed} = 1
          ${provUserFilter}`
      )
      .groupBy(sql`strftime('%Y-%m', ${provisions.buchungsDatum})`)
      .all()
      .filter((r) => r.month != null && r.revenue > 0);
  } catch {
    // provisions-Tabelle existiert noch nicht
  }

  if (revPrev > 0 && revThis > revPrev) {
    const pct = Math.round(((revThis - revPrev) / revPrev) * 100);
    insights.push({
      type: "success",
      icon: "trending",
      text: `Umsatz ${pct}% \u00fcber Vormonat`,
    });
  }

  if (revenueByMonthData.length >= 2) {
    const best = revenueByMonthData.reduce((a, b) => (b.revenue > a.revenue ? b : a));
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
        AND ${leads.reklamiertAt} IS NULL
        ${uSql}`
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
        AND (${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')
        ${uSql}`
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

function getLeadTrend(userId: number | null) {
  // Leads pro Woche der letzten 8 Wochen
  const uSql = userId !== null
    ? sql`AND (${leads.assignedTo} = ${userId} OR ${leads.assignedTo} IS NULL)`
    : sql``;
  const result = db
    .select({
      week: sql<string>`strftime('%Y-W%W', ${leads.createdAt})`,
      weekStart: sql<string>`date(${leads.createdAt}, 'weekday 1', '-7 days')`,
      count: sql<number>`count(*)`,
    })
    .from(leads)
    .where(sql`${leads.createdAt} >= date('now', '-56 days') ${uSql}`)
    .groupBy(sql`strftime('%Y-W%W', ${leads.createdAt})`)
    .orderBy(sql`strftime('%Y-W%W', ${leads.createdAt})`)
    .all();

  return result.map((r) => {
    const d = new Date(r.weekStart);
    const label = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.`;
    return { week: label, leads: r.count };
  });
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; all?: string; showAll?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role || "user";
  const currentUserId = session?.user?.id ? parseInt(session.user.id) : null;
  const isAdmin = userRole === "admin";

  // Admin sieht standardmaessig alle, kann auf "Meine" umschalten
  // Normale User sehen immer nur ihre eigenen Leads
  const showAll = isAdmin && params.showAll !== "0";
  const filterUserId = showAll ? null : currentUserId;

  const now = new Date();
  const hasFilter = params.month && params.year;
  const isAllMonths = !hasFilter || params.all === "1";
  const month = isAllMonths ? undefined : parseInt(params.month!);
  const year = isAllMonths ? undefined : parseInt(params.year!);
  const range = month && year ? getDateRange(month, year) : null;

  const kpis = getKpis(range, filterUserId);
  const wonLeads = getWonLeadsCount(range, filterUserId);
  const leadBudget = getLeadBudget();
  const insights = getSmartInsights(leadBudget, filterUserId);
  const pipelineData = getPipelineData(range, filterUserId);
  const revenueData = getRevenueByMonth(filterUserId);
  const gewerbeartData = getGewerbeartData(range, filterUserId);
  const leadTrend = getLeadTrend(filterUserId);
  const appointments = getUpcomingAppointments(filterUserId);
  const recentActivity = getRecentActivity(filterUserId);

  return (
    <div className="flex flex-col overflow-x-hidden">
      <Header title="Dashboard" actions={<div className="flex items-center gap-2"><UserFilter isAdmin={isAdmin} showAll={showAll} /><MonthFilter /><ReportButton /></div>} />
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
