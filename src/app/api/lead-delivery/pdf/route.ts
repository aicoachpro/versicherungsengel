import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadProviders, leadProducts } from "@/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { jsPDF } from "jspdf";

const MONTH_NAMES: Record<string, string> = {
  "01": "Januar", "02": "Februar", "03": "März", "04": "April",
  "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
  "09": "September", "10": "Oktober", "11": "November", "12": "Dezember",
};

function formatMonth(raw: string): string {
  const [y, m] = raw.split("-");
  return `${MONTH_NAMES[m] || m} ${y}`;
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + "…";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const providerIdStr = searchParams.get("providerId");
  const month = searchParams.get("month");

  if (!providerIdStr || !month) {
    return NextResponse.json(
      { error: "providerId und month sind erforderlich" },
      { status: 400 },
    );
  }

  const providerId = Number(providerIdStr);
  if (!providerId || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Ungueltige Parameter" }, { status: 400 });
  }

  const provider = db
    .select()
    .from(leadProviders)
    .where(eq(leadProviders.id, providerId))
    .get();
  if (!provider) {
    return NextResponse.json({ error: "Provider nicht gefunden" }, { status: 404 });
  }

  const rows = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      phase: leads.phase,
      productName: leadProducts.name,
      reklamationStatus: leads.reklamationStatus,
      reklamationNotiz: leads.reklamationNotiz,
    })
    .from(leads)
    .leftJoin(leadProducts, eq(leads.productId, leadProducts.id))
    .where(
      and(
        eq(leads.providerId, providerId),
        like(leads.eingangsdatum, `${month}%`),
      ),
    )
    .orderBy(sql`${leads.eingangsdatum} ASC`)
    .all();

  const total = rows.length;
  const reklamiertGenehmigt = rows.filter(
    (r) => r.reklamationStatus === "genehmigt",
  ).length;
  const netto = total - reklamiertGenehmigt;

  // PDF aufbauen (A4 Portrait, mm)
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Lead-Lieferung", marginLeft, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(provider.name, marginLeft, 27);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(formatMonth(month), marginLeft, 33);
  doc.setTextColor(0);

  // Stats-Box rechts
  const statsX = pageWidth - marginRight - 60;
  doc.setDrawColor(220);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(statsX, 15, 60, 22, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Geliefert (netto)", statsX + 3, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`${netto} / ${provider.minPerMonth}`, statsX + 3, 27);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`vertraglich pro Monat`, statsX + 3, 31);
  if (reklamiertGenehmigt > 0) {
    doc.text(`${reklamiertGenehmigt} storniert`, statsX + 3, 35);
  }
  doc.setTextColor(0);

  // Tabelle
  let y = 48;

  // Spalten-Definition (Summe = contentWidth = 180mm)
  const cols = [
    { key: "idx", label: "#", width: 8 },
    { key: "name", label: "Name", width: 55 },
    { key: "product", label: "Produkt", width: 42 },
    { key: "status", label: "Status", width: 32 },
    { key: "note", label: "Hinweis / Stornogrund", width: 43 },
  ];

  // Header-Zeile
  doc.setFillColor(60, 60, 60);
  doc.rect(marginLeft, y, contentWidth, 7, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  {
    let x = marginLeft + 2;
    for (const c of cols) {
      doc.text(c.label, x, y + 4.8);
      x += c.width;
    }
  }
  y += 7;

  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const rowHeight = 8;
  const footerReservation = 18;

  rows.forEach((lead, idx) => {
    // Seitenumbruch
    if (y + rowHeight > pageHeight - footerReservation) {
      doc.addPage();
      y = 20;
      // Repeat header
      doc.setFillColor(60, 60, 60);
      doc.rect(marginLeft, y, contentWidth, 7, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      let x = marginLeft + 2;
      for (const c of cols) {
        doc.text(c.label, x, y + 4.8);
        x += c.width;
      }
      y += 7;
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
    }

    const storniert = lead.reklamationStatus === "genehmigt";
    const isReklOffen = lead.reklamationStatus === "offen";

    // Zebra
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(marginLeft, y, contentWidth, rowHeight, "F");
    }
    // Storno: rötlicher Hintergrund
    if (storniert) {
      doc.setFillColor(253, 235, 235);
      doc.rect(marginLeft, y, contentWidth, rowHeight, "F");
    }

    const nameLine = lead.name || "—";
    const productLine = lead.productName || "—";
    const statusLine = storniert ? "Storniert" : lead.phase;
    const noteLine = storniert
      ? lead.reklamationNotiz || "kein Grund angegeben"
      : isReklOffen
        ? "Reklamation offen"
        : "";

    const textY = y + 5.2;
    let x = marginLeft + 2;

    // Idx
    doc.setTextColor(120);
    doc.text(String(idx + 1), x, textY);
    x += cols[0].width;

    // Name
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(truncate(nameLine, 32), x, textY);
    if (lead.ansprechpartner) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.setFontSize(7);
      doc.text(truncate(lead.ansprechpartner, 38), x, textY + 2.8);
      doc.setFontSize(8.5);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    x += cols[1].width;

    // Produkt
    doc.text(truncate(productLine, 24), x, textY);
    x += cols[2].width;

    // Status
    if (storniert) {
      doc.setTextColor(180, 30, 30);
      doc.setFont("helvetica", "bold");
    } else if (lead.phase === "Abgeschlossen") {
      doc.setTextColor(20, 120, 60);
    } else {
      doc.setTextColor(60);
    }
    doc.text(truncate(statusLine, 18), x, textY);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    x += cols[3].width;

    // Hinweis
    if (storniert) {
      doc.setTextColor(180, 30, 30);
    } else if (isReklOffen) {
      doc.setTextColor(180, 130, 0);
    } else {
      doc.setTextColor(120);
    }
    doc.text(truncate(noteLine, 28), x, textY);
    doc.setTextColor(0);

    y += rowHeight;
  });

  if (rows.length === 0) {
    doc.setTextColor(150);
    doc.setFontSize(10);
    doc.text("Keine Leads in diesem Monat.", marginLeft, y + 8);
    doc.setTextColor(0);
  }

  // Footer
  const generatedAt = new Date().toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Erstellt am ${generatedAt}  ·  Versicherungsengel`,
      marginLeft,
      pageHeight - 8,
    );
    doc.text(`Seite ${i} / ${pageCount}`, pageWidth - marginRight, pageHeight - 8, {
      align: "right",
    });
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Lead-Lieferung_${provider.name.replace(/[^a-zA-Z0-9]/g, "_")}_${month}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
