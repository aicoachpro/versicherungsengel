import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { jsPDF } from "jspdf";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

  // Daten sammeln
  const allLeads = db.select().from(leads).all();
  const totalLeads = allLeads.length;
  const openLeads = allLeads.filter((l) => !["Abgeschlossen", "Verloren"].includes(l.phase) && !l.archivedAt).length;
  const wonLeads = allLeads.filter((l) => l.phase === "Abgeschlossen").length;
  const lostLeads = allLeads.filter((l) => l.phase === "Verloren").length;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0;
  const totalRevenue = allLeads.filter((l) => l.phase === "Abgeschlossen").reduce((s, l) => s + (l.umsatz || 0), 0);
  const totalCosts = allLeads.reduce((s, l) => s + (l.terminKosten || 0), 0);
  const roi = totalCosts > 0 ? Math.round(((totalRevenue - totalCosts) / totalCosts) * 1000) / 10 : 0;

  // Pipeline-Verteilung
  const phases = ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt", "Abgeschlossen", "Verloren"];
  const pipelineData = phases.map((phase) => ({
    phase,
    count: allLeads.filter((l) => l.phase === phase).length,
  }));

  // Top-Leads nach Umsatz
  const topLeads = allLeads
    .filter((l) => l.umsatz && l.umsatz > 0)
    .sort((a, b) => (b.umsatz || 0) - (a.umsatz || 0))
    .slice(0, 5);

  // PDF generieren
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("VÖLKER Finance OHG", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Allianz Generalvertretung", 14, 27);
  doc.text(`Bericht: ${formatDate(from)} – ${formatDate(to)}`, 14, 33);
  doc.text(`Erstellt: ${formatDate(new Date().toISOString().split("T")[0])}`, 14, 39);

  // Linie
  doc.setDrawColor(0, 55, 129); // Allianz Blau
  doc.setLineWidth(0.8);
  doc.line(14, 43, pageWidth - 14, 43);

  // KPIs
  let y = 55;
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Kennzahlen", 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const kpis = [
    ["Leads gesamt", String(totalLeads)],
    ["Offene Leads", String(openLeads)],
    ["Abgeschlossen", String(wonLeads)],
    ["Verloren", String(lostLeads)],
    ["Conversion Rate", `${conversionRate}%`],
    ["Umsatz", formatCurrency(totalRevenue)],
    ["Termin-Kosten", formatCurrency(totalCosts)],
    ["ROI", `${roi}%`],
  ];

  for (const [label, value] of kpis) {
    doc.setFont("helvetica", "normal");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, 80, y);
    y += 7;
  }

  // Pipeline-Verteilung
  y += 8;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Pipeline-Verteilung", 14, y);
  y += 10;

  doc.setFontSize(10);
  for (const item of pipelineData) {
    doc.setFont("helvetica", "normal");
    doc.text(item.phase, 14, y);
    doc.setFont("helvetica", "bold");
    doc.text(String(item.count), 80, y);

    // Balken
    const maxBarWidth = 90;
    const maxCount = Math.max(...pipelineData.map((p) => p.count), 1);
    const barWidth = (item.count / maxCount) * maxBarWidth;
    doc.setFillColor(0, 55, 129);
    doc.rect(90, y - 4, barWidth, 5, "F");

    y += 8;
  }

  // Top-Leads
  if (topLeads.length > 0) {
    y += 8;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top-Leads nach Umsatz", 14, y);
    y += 10;

    doc.setFontSize(10);
    for (const lead of topLeads) {
      doc.setFont("helvetica", "normal");
      doc.text(lead.name, 14, y);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(lead.umsatz || 0), 120, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(lead.phase, 160, y);
      doc.setTextColor(0);
      y += 7;
    }
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Versicherungsengel CRM — VÖLKER Finance OHG", 14, pageHeight - 10);
  doc.text(`Seite 1`, pageWidth - 25, pageHeight - 10);

  // PDF ausgeben
  const buffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="voelker-report-${from}-${to}.pdf"`,
    },
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
