import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, insurances, activities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

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

  // Markdown generieren
  let md = `# Übergabedokument: ${lead.name}\n\n`;
  md += `**Exportdatum:** ${new Date().toLocaleDateString("de-DE")}\n`;
  md += `**Status:** ${lead.phase}\n\n`;

  md += `## Stammdaten\n\n`;
  md += `| Feld | Wert |\n|------|------|\n`;
  md += `| Firmenname | ${lead.name} |\n`;
  md += `| Ansprechpartner | ${lead.ansprechpartner || "–"} |\n`;
  md += `| E-Mail | ${lead.email || "–"} |\n`;
  md += `| Telefon | ${lead.telefon || "–"} |\n`;
  md += `| Website | ${lead.website || "–"} |\n`;
  md += `| Branche | ${lead.branche || "–"} |\n`;
  md += `| Unternehmensgröße | ${lead.unternehmensgroesse || "–"} |\n`;
  md += `| Umsatzklasse | ${lead.umsatzklasse || "–"} |\n`;
  md += `| Gewerbeart | ${lead.gewerbeart || "–"} |\n`;
  md += `| Eingangsdatum | ${formatDate(lead.eingangsdatum)} |\n`;
  md += `| Termin | ${formatDateTime(lead.termin)} |\n`;
  md += `| Folgetermin | ${formatDateTime(lead.folgetermin)} |\n`;
  md += `| Terminkosten | ${formatCurrency(lead.terminKosten)} |\n`;
  md += `| Umsatz | ${formatCurrency(lead.umsatz)} |\n`;
  md += `| Nächster Schritt | ${lead.naechsterSchritt || "–"} |\n`;
  md += `| Notizen | ${lead.notizen || "–"} |\n`;

  if (crossSellingList.length > 0) {
    md += `\n## Cross-Selling\n\n`;
    crossSellingList.forEach((p) => { md += `- ${p}\n`; });
  }

  if (vertrage.length > 0) {
    md += `\n## Fremdverträge (${vertrage.length})\n\n`;
    md += `| Bezeichnung | Produkt | Versicherer | Sparte | Beitrag | Zahlweise | Ablauf | Umfang |\n`;
    md += `|-------------|---------|-------------|--------|---------|-----------|--------|--------|\n`;
    vertrage.forEach((v) => {
      md += `| ${v.bezeichnung} | ${v.produkt || "–"} | ${v.versicherer || "–"} | ${v.sparte || "–"} | ${formatCurrency(v.beitrag)} | ${v.zahlweise || "–"} | ${formatDate(v.ablauf)} | ${v.umfang || "–"} |\n`;
    });
  }

  if (aktivitaeten.length > 0) {
    md += `\n## Aktivitäten (${aktivitaeten.length})\n\n`;
    md += `| Datum | Kontaktart | Notiz |\n`;
    md += `|-------|------------|-------|\n`;
    aktivitaeten.forEach((a) => {
      md += `| ${formatDateTime(a.datum)} | ${a.kontaktart} | ${a.notiz || "–"} |\n`;
    });
  }

  md += `\n---\n*Generiert aus Versicherungsengel CRM am ${new Date().toLocaleDateString("de-DE")}*\n`;

  const filename = `Uebergabe_${lead.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}_${new Date().toISOString().split("T")[0]}.md`;

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
