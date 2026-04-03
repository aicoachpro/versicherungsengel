import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, insurances, activities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { jsPDF } from "jspdf";
import { getBranding } from "@/lib/branding";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString("de-DE");
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatCurrency(value: number | null): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

/** Parse hex color (#003781) to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const leadId = Number(id);

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const vertrage = db
    .select()
    .from(insurances)
    .where(eq(insurances.leadId, leadId))
    .orderBy(insurances.bezeichnung)
    .all();

  const aktivitaeten = db
    .select()
    .from(activities)
    .where(eq(activities.leadId, leadId))
    .orderBy(desc(activities.datum))
    .all();

  let crossSellingList: string[] = [];
  if (lead.crossSelling) {
    try { crossSellingList = JSON.parse(lead.crossSelling); } catch { /* ignore */ }
  }

  // --- PDF generieren ---
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const b = getBranding();
  const [cr, cg, cb] = hexToRgb(b.color);
  let pageNum = 1;

  /** Zeichnet den Footer auf die aktuelle Seite */
  function drawFooter() {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `${b.companyName}${b.subtitle ? " — " + b.subtitle : ""} | Erstellt: ${new Date().toLocaleDateString("de-DE")}`,
      marginLeft,
      pageHeight - 10
    );
    doc.text(`Seite ${pageNum}`, pageWidth - 25, pageHeight - 10);
  }

  /** Prüft ob genug Platz bleibt, sonst neue Seite */
  function ensureSpace(needed: number, currentY: number): number {
    if (currentY + needed > pageHeight - 20) {
      drawFooter();
      doc.addPage();
      pageNum++;
      return 20;
    }
    return currentY;
  }

  /** Zeichnet eine Trennlinie */
  function drawSeparator(y: number): number {
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    return y + 6;
  }

  /** Zeichnet einen Sektions-Titel */
  function drawSectionTitle(title: string, y: number): number {
    y = ensureSpace(20, y);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(cr, cg, cb);
    doc.text(title, marginLeft, y);
    doc.setTextColor(0);
    y += 2;
    doc.setDrawColor(cr, cg, cb);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 8;
    return y;
  }

  /** Zeichnet ein Label-Wert-Paar */
  function drawField(label: string, value: string, y: number, labelWidth = 55): number {
    y = ensureSpace(8, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(label, marginLeft, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    // Wrap langen Text
    const maxWidth = contentWidth - labelWidth;
    const lines = doc.splitTextToSize(value || "–", maxWidth);
    doc.text(lines, marginLeft + labelWidth, y);
    return y + Math.max(lines.length, 1) * 5 + 2;
  }

  // ==========================================
  // HEADER
  // ==========================================
  doc.setFillColor(cr, cg, cb);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(b.companyName, marginLeft, 18);

  if (b.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(b.subtitle, marginLeft, 26);
  }

  doc.setFontSize(10);
  doc.text("Lead-Datenblatt", marginLeft, 35);

  // ==========================================
  // Lead-Name Bereich
  // ==========================================
  let y = 52;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(lead.name, marginLeft, y);
  y += 6;

  // Phase-Badge
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(cr, cg, cb);
  doc.text(`Phase: ${lead.phase}`, marginLeft, y);
  doc.setTextColor(0);
  y += 10;

  y = drawSeparator(y);

  // ==========================================
  // STAMMDATEN
  // ==========================================
  y = drawSectionTitle("Stammdaten", y);

  // Zwei-Spalten-Layout für Stammdaten
  const col1X = marginLeft;
  const col2X = pageWidth / 2 + 5;
  const colWidth = 50;
  let yLeft = y;
  let yRight = y;

  function drawFieldCol(label: string, value: string, col: 1 | 2): void {
    const x = col === 1 ? col1X : col2X;
    const currentY = col === 1 ? yLeft : yRight;
    const checkedY = ensureSpace(8, currentY);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(label, x, checkedY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(value || "–", x + colWidth, checkedY);

    if (col === 1) yLeft = checkedY + 7;
    else yRight = checkedY + 7;
  }

  drawFieldCol("Firmenname", lead.name, 1);
  drawFieldCol("Phase", lead.phase, 2);
  drawFieldCol("Ansprechpartner", lead.ansprechpartner || "–", 1);
  drawFieldCol("Branche", lead.branche || "–", 2);
  drawFieldCol("E-Mail", lead.email || "–", 1);
  drawFieldCol("Unternehmensgr.", lead.unternehmensgroesse || "–", 2);
  drawFieldCol("Telefon", lead.telefon || "–", 1);
  drawFieldCol("Umsatzklasse", lead.umsatzklasse || "–", 2);
  drawFieldCol("Website", lead.website || "–", 1);
  drawFieldCol("Gewerbeart", lead.gewerbeart || "–", 2);

  y = Math.max(yLeft, yRight) + 4;
  y = drawSeparator(y);

  // ==========================================
  // ADRESSE
  // ==========================================
  if (lead.strasse || lead.plz || lead.ort) {
    y = drawSectionTitle("Adresse", y);
    const adresse = [lead.strasse, [lead.plz, lead.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    y = drawField("Anschrift", adresse, y);
    y += 4;
    y = drawSeparator(y);
  }

  // ==========================================
  // TERMINE & FRISTEN
  // ==========================================
  y = drawSectionTitle("Termine & Fristen", y);
  y = drawField("Eingangsdatum", formatDate(lead.eingangsdatum), y);
  y = drawField("Termin", formatDateTime(lead.termin), y);
  y = drawField("Folgetermin", formatDateTime(lead.folgetermin), y);
  if (lead.folgeterminTyp) {
    y = drawField("Folgetermin-Typ", lead.folgeterminTyp, y);
  }
  y += 4;
  y = drawSeparator(y);

  // ==========================================
  // FINANZEN
  // ==========================================
  y = drawSectionTitle("Finanzen", y);
  y = drawField("Umsatz", formatCurrency(lead.umsatz), y);
  y = drawField("Terminkosten", formatCurrency(lead.terminKosten), y);
  y += 4;
  y = drawSeparator(y);

  // ==========================================
  // NOTIZEN & NÄCHSTER SCHRITT
  // ==========================================
  if (lead.notizen || lead.naechsterSchritt) {
    y = drawSectionTitle("Notizen", y);
    if (lead.naechsterSchritt) {
      y = drawField("Nächster Schritt", lead.naechsterSchritt, y);
    }
    if (lead.notizen) {
      y = drawField("Notizen", lead.notizen, y);
    }
    y += 4;
    y = drawSeparator(y);
  }

  // ==========================================
  // CROSS-SELLING
  // ==========================================
  if (crossSellingList.length > 0) {
    y = drawSectionTitle("Cross-Selling", y);
    for (const item of crossSellingList) {
      y = ensureSpace(7, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(`•  ${item}`, marginLeft + 2, y);
      y += 6;
    }
    y += 4;
    y = drawSeparator(y);
  }

  // ==========================================
  // FREMDVERTRÄGE
  // ==========================================
  if (vertrage.length > 0) {
    y = drawSectionTitle(`Fremdverträge (${vertrage.length})`, y);

    // Tabellen-Header
    const cols = [
      { label: "Bezeichnung", x: marginLeft, w: 35 },
      { label: "Sparte", x: marginLeft + 35, w: 25 },
      { label: "Versicherer", x: marginLeft + 60, w: 30 },
      { label: "Beitrag", x: marginLeft + 90, w: 25 },
      { label: "Zahlweise", x: marginLeft + 115, w: 25 },
      { label: "Ablauf", x: marginLeft + 140, w: 25 },
    ];

    y = ensureSpace(12, y);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, y - 4, contentWidth, 6, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    for (const col of cols) {
      doc.text(col.label, col.x, y);
    }
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    for (const v of vertrage) {
      y = ensureSpace(8, y);
      doc.setFontSize(8);
      doc.text((v.bezeichnung || "–").substring(0, 20), cols[0].x, y);
      doc.text((v.sparte || "–").substring(0, 15), cols[1].x, y);
      doc.text((v.versicherer || "–").substring(0, 18), cols[2].x, y);
      doc.text(formatCurrency(v.beitrag), cols[3].x, y);
      doc.text((v.zahlweise || "–"), cols[4].x, y);
      doc.text(formatDate(v.ablauf), cols[5].x, y);
      y += 6;
    }

    y += 4;
    y = drawSeparator(y);
  }

  // ==========================================
  // AKTIVITÄTEN
  // ==========================================
  if (aktivitaeten.length > 0) {
    y = drawSectionTitle(`Aktivitäten (${aktivitaeten.length})`, y);

    const aCols = [
      { label: "Datum", x: marginLeft, w: 35 },
      { label: "Kontaktart", x: marginLeft + 35, w: 30 },
      { label: "Notiz", x: marginLeft + 65, w: 100 },
    ];

    y = ensureSpace(12, y);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, y - 4, contentWidth, 6, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    for (const col of aCols) {
      doc.text(col.label, col.x, y);
    }
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    for (const a of aktivitaeten) {
      y = ensureSpace(8, y);
      doc.setFontSize(8);
      doc.text(formatDateTime(a.datum), aCols[0].x, y);
      doc.text(a.kontaktart, aCols[1].x, y);
      const notizLines = doc.splitTextToSize(a.notiz || "–", aCols[2].w);
      doc.text(notizLines, aCols[2].x, y);
      y += Math.max(notizLines.length, 1) * 4 + 3;
    }

    y += 4;
  }

  // ==========================================
  // REKLAMATION (falls vorhanden)
  // ==========================================
  if (lead.reklamiertAt) {
    y = drawSectionTitle("Reklamation", y);
    y = drawField("Reklamiert am", formatDate(lead.reklamiertAt), y);
    y = drawField("Status", lead.reklamationStatus || "–", y);
    if (lead.reklamationNotiz) {
      y = drawField("Notiz", lead.reklamationNotiz, y);
    }
    y += 4;
  }

  // ==========================================
  // FOOTER
  // ==========================================
  drawFooter();

  // PDF ausgeben
  const buffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `Lead_${lead.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
