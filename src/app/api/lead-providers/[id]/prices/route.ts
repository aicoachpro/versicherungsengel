import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadProviders, providerProducts, leadProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { chat } from "@/lib/ai-client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * Parst einen Preis-String im deutschen oder englischen Format:
 * "64,41" → 64.41, "33.21" → 33.21, "\"64,41\"" → 64.41, "0" → 0
 */
function parsePrice(raw: string): number {
  // Anführungszeichen entfernen
  let s = raw.trim().replace(/^["']|["']$/g, "").trim();
  // Deutsches Format: Komma als Dezimaltrenner (nur wenn kein Punkt vorhanden)
  if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  // Alles ausser Ziffern und Punkt entfernen
  s = s.replace(/[^\d.]/g, "");
  return parseFloat(s) || 0;
}

/**
 * Echter CSV-Parser der quoted fields mit eingebetteten Trennzeichen handhabt.
 * Unterstuetzt Semikolon und Komma. Bestimmt den Trenner automatisch aus der ersten Zeile.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Normalisiert Text fuer Matching: lowercase, Umlaute → ae/oe/ue/ss,
 * Leerzeichen und Sonderzeichen entfernen.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(line: string): string {
  // Zaehlt nur Trennzeichen AUSSERHALB von Quotes
  let semiCount = 0;
  let commaCount = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ";") semiCount++;
      else if (ch === ",") commaCount++;
    }
  }
  return semiCount >= commaCount ? ";" : ",";
}

/**
 * POST /api/lead-providers/[id]/prices
 * CSV-Upload fuer Preisliste.
 * Unterstuetzte Formate:
 * - "Kuerzel;Produktbezeichnung;Preis" (3 Spalten, Check-Direkt Format)
 * - "Sparte;Preis" (2 Spalten)
 * Matching: Erst nach Kuerzel, dann nach Name (exakt + Teilstring)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const providerId = Number(id);
  if (!providerId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const provider = db.select().from(leadProviders).where(eq(leadProviders.id, providerId)).get();
  if (!provider) return NextResponse.json({ error: "Provider nicht gefunden" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const priceType = (formData.get("priceType") as string) || "brutto"; // "brutto" | "netto"
  if (!file) return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });

  // MwSt-Aufschlag bei Netto-Preisen (19% deutsche MwSt)
  const VAT_RATE = 0.19;
  const applyVat = priceType === "netto";

  // Datei als Buffer lesen und Encoding erkennen
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let text: string;
  try {
    text = buffer.toString("utf-8");
    // Mojibake erkennen: "Ã¼" = UTF-8 Bytes als Latin-1 interpretiert
    if (/Ã[¤¶¼ÄÖÜ]|Ã\u009f/.test(text)) {
      // Re-decode: UTF-8 → Latin-1 Bytes → UTF-8
      text = Buffer.from(text, "latin1").toString("utf-8");
    }
  } catch {
    text = buffer.toString("latin1");
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  // Alle Lead-Produkte laden fuer Matching
  const allProducts = db.select().from(leadProducts).all();

  // Maps fuer schnelles Matching (normalisiert: ohne Umlaute/Leerzeichen)
  const byKuerzel = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const p of allProducts) {
    if (p.kuerzel) byKuerzel.set(normalize(p.kuerzel), p.id);
    byName.set(normalize(p.name), p.id);
  }

  let matched = 0;
  let skipped = 0;
  const results: { sparte: string; preis: number; matched: boolean }[] = [];
  const unmatchedItems: { sparte: string; preis: number }[] = [];

  // Bestehende purchased-Flags merken bevor wir die Preise neu setzen
  const existingPurchased = db
    .select()
    .from(providerProducts)
    .where(eq(providerProducts.providerId, providerId))
    .all();
  const purchasedSet = new Set(
    existingPurchased.filter((pp) => pp.purchased).map((pp) => pp.productId)
  );

  // Bestehende Links loeschen und neu aufbauen
  db.delete(providerProducts).where(eq(providerProducts.providerId, providerId)).run();

  // Trenner erkennen (Semikolon oder Komma) aus der ersten Zeile
  const delimiter = detectDelimiter(lines[0] || "");

  // Header-Zeile analysieren um Spalten-Indizes zu finden
  const headerLine = lines[0] || "";
  const headerParts = parseCsvLine(headerLine, delimiter).map((h) => normalize(h));

  // Spalten-Indizes bestimmen (flexibel fuer verschiedene CSV-Formate)
  let sparteIdx = headerParts.findIndex((h) => /^(abonnement|sparte|produkt|name)$/.test(h));
  let kuerzelIdx = headerParts.findIndex((h) => /^(kuerzel|code|id)$/.test(h));
  let preisIdx = headerParts.findIndex((h) => /^(preis|price|kosten|cost|preismittelwerteuro)$/.test(h));

  // Fallback: Wenn kein Header erkannt, Format raten
  const hasSmartHeader = sparteIdx >= 0 || preisIdx >= 0;

  if (!hasSmartHeader) {
    // Altes Verhalten: 3-Spalten = Kuerzel;Name;Preis, 2-Spalten = Sparte;Preis
    const firstDataLine = lines.find((l) => !/^(kuerzel|sparte|produkt|name)/i.test(l));
    const firstParts = firstDataLine ? parseCsvLine(firstDataLine, delimiter) : [];
    if (firstParts.length >= 3) {
      kuerzelIdx = 0; sparteIdx = 1; preisIdx = 2;
    } else {
      sparteIdx = 0; preisIdx = 1;
    }
  }

  // Wenn Sparte nicht gefunden, erste Spalte verwenden
  if (sparteIdx < 0) sparteIdx = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // Header-Zeile ueberspringen
    if (lineIdx === 0 && hasSmartHeader) continue;
    if (/^(kuerzel|sparte|produkt|name|abonnement)/i.test(line)) continue;

    const parts = parseCsvLine(line, delimiter);
    const kuerzel = kuerzelIdx >= 0 && kuerzelIdx < parts.length ? parts[kuerzelIdx].trim() : "";
    const sparte = sparteIdx >= 0 && sparteIdx < parts.length ? parts[sparteIdx].trim() : "";
    const preisRaw = preisIdx >= 0 && preisIdx < parts.length ? parts[preisIdx] : "";

    if (!sparte && !kuerzel) continue;

    const preisNetto = parsePrice(preisRaw);
    // Bei netto-Upload: 19% MwSt aufschlagen und auf 2 Nachkommastellen runden
    const preis = applyVat
      ? Math.round(preisNetto * (1 + VAT_RATE) * 100) / 100
      : preisNetto;

    // Matching-Reihenfolge (alle normalisiert):
    // 1. Exakt nach Kuerzel
    // 2. Exakt nach Name
    // 3. Teilstring-Match nach Name
    let productId: number | undefined;

    if (kuerzel) {
      productId = byKuerzel.get(normalize(kuerzel));
    }
    if (!productId && sparte) {
      productId = byName.get(normalize(sparte));
    }
    if (!productId && sparte) {
      const sparteNorm = normalize(sparte);
      for (const [name, pid] of byName.entries()) {
        if (name.includes(sparteNorm) || sparteNorm.includes(name)) {
          productId = pid;
          break;
        }
      }
    }

    const label = sparte || kuerzel;
    if (productId) {
      db.insert(providerProducts)
        .values({
          providerId,
          productId,
          costPerLead: preis,
          purchased: purchasedSet.has(productId),
        })
        .run();
      matched++;
      results.push({ sparte: label, preis, matched: true });
    } else {
      unmatchedItems.push({ sparte: label, preis });
    }
  }

  // KI-Fallback fuer nicht-gematchte Sparten (z.B. Allianz "Krankenzusatz und Pflege")
  if (unmatchedItems.length > 0) {
    try {
      const productList = allProducts.map((p) => `${p.id}: ${p.kuerzel ? `[${p.kuerzel}] ` : ""}${p.name}`).join("\n");
      const spartenList = unmatchedItems.map((u) => u.sparte).join("\n");

      const aiResponse = await chat([
        {
          role: "system",
          content: `Du bist Versicherungs-Experte. Ordne die folgenden Lead-Anbieter-Sparten den passenden Produkten zu.

PRODUKTE (id: [kuerzel] name):
${productList}

Gib NUR ein JSON-Array zurueck. Fuer jede Sparte ein Objekt:
{"sparte": "Krankenzusatz und Pflege", "productId": 11, "confidence": 0.9}

Regeln:
- Nur mappen bei echter Entsprechung (confidence >= 0.6)
- Bei keinem passenden Produkt: productId = null
- "Privat Sach" kann Hausrat ODER Wohngebaeude sein — nimm das uebergeordnetere
- "Uebergreifende Beratung" = "Beratung"
- NUR JSON, kein anderer Text`,
        },
        { role: "user", content: spartenList },
      ]);

      const aiMappings = JSON.parse(
        aiResponse.content.replace(/```json?\s*/g, "").replace(/```/g, "").trim()
      );

      for (const mapping of aiMappings) {
        const item = unmatchedItems.find((u) => u.sparte === mapping.sparte);
        if (!item) continue;

        if (mapping.productId && mapping.confidence >= 0.6) {
          db.insert(providerProducts)
            .values({
              providerId,
              productId: mapping.productId,
              costPerLead: item.preis,
              purchased: purchasedSet.has(mapping.productId),
            })
            .run();
          matched++;
          results.push({ sparte: item.sparte, preis: item.preis, matched: true });
        } else {
          skipped++;
          results.push({ sparte: item.sparte, preis: item.preis, matched: false });
        }
      }
    } catch {
      // KI nicht erreichbar — alle als unmatched zaehlen
      for (const item of unmatchedItems) {
        skipped++;
        results.push({ sparte: item.sparte, preis: item.preis, matched: false });
      }
    }
  }

  return NextResponse.json({
    matched,
    skipped,
    total: matched + skipped,
    priceType,
    vatApplied: applyVat,
    results,
  });
}
