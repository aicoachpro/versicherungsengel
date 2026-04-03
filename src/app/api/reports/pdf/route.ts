import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { jsPDF } from "jspdf";
import { getBranding } from "@/lib/branding";

/** Hex-Farbe (#003781) in RGB-Array konvertieren */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

const notGenehmigtReklamiert = sql`(${leads.reklamiertAt} IS NULL OR ${leads.reklamationStatus} != 'genehmigt')`;

function queryMonth(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));

  const totalLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(baseFilter).get();
  const wonLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), baseFilter)).get();
  const lostLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, "Verloren"), baseFilter)).get();
  const openLeads = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(
    sql`${leads.phase} NOT IN ('Abgeschlossen', 'Verloren')`,
    sql`${leads.archivedAt} IS NULL`,
    baseFilter,
  )).get();
  const totalRevenue = db.select({ total: sql<number>`coalesce(sum(${leads.umsatz}), 0)` }).from(leads).where(and(eq(leads.phase, "Abgeschlossen"), baseFilter)).get();
  const totalCosts = db.select({ total: sql<number>`coalesce(sum(${leads.terminKosten}), 0)` }).from(leads).where(baseFilter).get();

  const total = totalLeads?.count || 0;
  const won = wonLeads?.count || 0;
  const lost = lostLeads?.count || 0;
  const open = openLeads?.count || 0;
  const revenue = totalRevenue?.total || 0;
  const costs = totalCosts?.total || 0;
  const conversion = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;
  const profit = revenue - costs;
  const roi = costs > 0 ? Math.round((profit / costs) * 1000) / 10 : 0;

  return { total, won, lost, open, revenue, costs, profit, conversion, roi };
}

function queryPipeline(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));

  const phases = ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt", "Abgeschlossen", "Verloren"] as const;
  return phases.map((phase) => {
    const r = db.select({ count: sql<number>`count(*)` }).from(leads).where(and(eq(leads.phase, phase), baseFilter)).get();
    return { phase, count: r?.count || 0 };
  });
}

function queryTopLeads(month: number, year: number, limit = 5) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59`;
  const baseFilter = and(notGenehmigtReklamiert, gte(leads.eingangsdatum, from), lte(leads.eingangsdatum, to));

  return db.select({
    name: leads.name,
    umsatz: leads.umsatz,
    phase: leads.phase,
    branche: leads.branche,
  })
    .from(leads)
    .where(and(baseFilter, sql`${leads.umsatz} > 0`))
    .orderBy(sql`${leads.umsatz} DESC`)
    .limit(limit)
    .all();
}

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const b = getBranding();
  const [r, g, bl] = hexToRgb(b.color);

  // Aktueller Monat + Vormonat
  const cur = queryMonth(month, year);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prev = queryMonth(prevMonth, prevYear);

  // Pipeline + Top-Leads
  const pipelineData = queryPipeline(month, year);
  const topLeads = queryTopLeads(month, year);

  const monthName = MONTH_NAMES[month - 1];
  const prevMonthName = MONTH_NAMES[prevMonth - 1];

  // --- PDF generieren ---
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Farbige Kopfzeile (Balken)
  doc.setFillColor(r, g, bl);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Firmenname
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(r, g, bl);
  doc.text(b.companyName, margin, 22);

  // Untertitel
  if (b.subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(b.subtitle, margin, 29);
  }

  // Berichtszeitraum
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Monatsbericht ${monthName} ${year}`, margin, 36);
  doc.text(`Erstellt: ${formatDate(now.toISOString().split("T")[0])}`, margin, 42);

  // Trennlinie
  doc.setDrawColor(r, g, bl);
  doc.setLineWidth(0.8);
  doc.line(margin, 46, pageWidth - margin, 46);

  // --- KPI-Sektion mit Monatsvergleich ---
  let y = 56;
  doc.setTextColor(r, g, bl);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Kennzahlen", margin, y);
  y += 3;

  // Tabellen-Header
  y += 7;
  doc.setFontSize(9);
  doc.setFillColor(r, g, bl);
  doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Kennzahl", margin + 2, y);
  doc.text(monthName, 90, y);
  doc.text(prevMonthName, 125, y);
  doc.text("Trend", 160, y);
  doc.setTextColor(0);
  y += 7;

  const kpiRows: [string, string, string, number, number][] = [
    ["Leads gesamt", String(cur.total), String(prev.total), cur.total, prev.total],
    ["Offene Leads", String(cur.open), String(prev.open), cur.open, prev.open],
    ["Abgeschlossen", String(cur.won), String(prev.won), cur.won, prev.won],
    ["Verloren", String(cur.lost), String(prev.lost), cur.lost, prev.lost],
    ["Conversion Rate", `${cur.conversion}%`, `${prev.conversion}%`, cur.conversion, prev.conversion],
    ["Umsatz", formatCurrency(cur.revenue), formatCurrency(prev.revenue), cur.revenue, prev.revenue],
    ["Terminkosten", formatCurrency(cur.costs), formatCurrency(prev.costs), cur.costs, prev.costs],
    ["Gewinn", formatCurrency(cur.profit), formatCurrency(prev.profit), cur.profit, prev.profit],
    ["ROI", `${cur.roi}%`, `${prev.roi}%`, cur.roi, prev.roi],
  ];

  doc.setFontSize(9);
  for (let i = 0; i < kpiRows.length; i++) {
    const [label, curVal, prevVal, curNum, prevNum] = kpiRows[i];

    // Zebra-Streifen
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(label, margin + 2, y);
    doc.setFont("helvetica", "bold");
    doc.text(curVal, 90, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(prevVal, 125, y);

    // Trend-Pfeil
    const trendStr = trendLabel(curNum, prevNum);
    if (trendStr.includes("+")) {
      doc.setTextColor(0, 150, 0);
    } else if (trendStr.includes("-")) {
      doc.setTextColor(200, 0, 0);
    } else {
      doc.setTextColor(100);
    }
    doc.text(trendStr, 160, y);
    doc.setTextColor(0);
    y += 6;
  }

  // --- Pipeline-Verteilung ---
  y += 10;
  doc.setTextColor(r, g, bl);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Pipeline-Verteilung", margin, y);
  y += 10;

  doc.setFontSize(9);
  const maxCount = Math.max(...pipelineData.map((p) => p.count), 1);
  for (const item of pipelineData) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(item.phase, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(String(item.count), 78, y);

    // Balken mit Branding-Farbe
    const maxBarWidth = 90;
    const barWidth = (item.count / maxCount) * maxBarWidth;
    if (barWidth > 0) {
      doc.setFillColor(r, g, bl);
      doc.rect(88, y - 3.5, barWidth, 4.5, "F");
    }

    y += 8;
  }

  // --- Top-Leads ---
  if (topLeads.length > 0) {
    y += 8;

    // Neue Seite falls zu wenig Platz
    if (y > pageHeight - 60) {
      addFooter(doc, b, pageWidth, pageHeight, margin);
      doc.addPage();
      doc.setFillColor(r, g, bl);
      doc.rect(0, 0, pageWidth, 4, "F");
      y = 20;
    }

    doc.setTextColor(r, g, bl);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top-Leads nach Umsatz", margin, y);
    y += 3;

    // Tabellen-Header
    y += 7;
    doc.setFontSize(9);
    doc.setFillColor(r, g, bl);
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Name", margin + 2, y);
    doc.text("Branche", 80, y);
    doc.text("Umsatz", 130, y);
    doc.text("Phase", 160, y);
    doc.setTextColor(0);
    y += 7;

    doc.setFontSize(9);
    for (let i = 0; i < topLeads.length; i++) {
      const lead = topLeads[i];
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 250);
        doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text((lead.name || "").substring(0, 30), margin + 2, y);
      doc.setTextColor(80);
      doc.text((lead.branche || "—").substring(0, 20), 80, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(formatCurrency(lead.umsatz || 0), 130, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(lead.phase, 160, y);
      y += 6;
    }
  }

  // Footer
  addFooter(doc, b, pageWidth, pageHeight, margin);

  // PDF ausgeben
  const buffer = Buffer.from(doc.output("arraybuffer"));
  const slug = b.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const filename = `${slug}-report-${year}-${String(month).padStart(2, "0")}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function addFooter(doc: jsPDF, b: { companyName: string; subtitle: string }, pageWidth: number, pageHeight: number, margin: number) {
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`${b.companyName}${b.subtitle ? " — " + b.subtitle : ""}`, margin, pageHeight - 10);
  const pageCount = doc.getNumberOfPages();
  doc.text(`Seite ${doc.getCurrentPageInfo().pageNumber} / ${pageCount}`, pageWidth - 35, pageHeight - 10);
}

function trendLabel(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const diff = Math.round(((current - previous) / previous) * 100);
  if (diff > 0) return `+${diff}%`;
  if (diff < 0) return `${diff}%`;
  return "0%";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
