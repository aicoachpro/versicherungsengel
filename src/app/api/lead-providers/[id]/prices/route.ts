import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadProviders, providerProducts, leadProducts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

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
  if (!file) return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });

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

  // Bestehende Links loeschen und neu aufbauen
  db.delete(providerProducts).where(eq(providerProducts.providerId, providerId)).run();

  // Trenner erkennen (Semikolon oder Komma) aus der ersten Zeile
  const delimiter = detectDelimiter(lines[0] || "");

  // Format erkennen: Hat die erste Datenzeile 3 Spalten? (Kuerzel;Name;Preis)
  const firstDataLine = lines.find((l) => !/^(kuerzel|sparte|produkt|name)/i.test(l));
  const firstParts = firstDataLine ? parseCsvLine(firstDataLine, delimiter) : [];
  const isThreeCol = firstParts.length >= 3;

  for (const line of lines) {
    // Header-Zeile ueberspringen
    if (/^(kuerzel|sparte|produkt|name)/i.test(line)) continue;

    const parts = parseCsvLine(line, delimiter);
    let kuerzel = "";
    let sparte = "";
    let preisRaw = "";

    if (isThreeCol && parts.length >= 3) {
      // Format: Kuerzel;Name;Preis (Check-Direkt)
      kuerzel = parts[0].trim();
      sparte = parts[1].trim();
      preisRaw = parts[2];
    } else if (parts.length >= 2) {
      // Format: Sparte;Preis
      sparte = parts[0].trim();
      preisRaw = parts[1];
    } else {
      continue;
    }

    const preis = parsePrice(preisRaw);

    if (!sparte && !kuerzel) {
      results.push({ sparte: "(leer)", preis: 0, matched: false });
      skipped++;
      continue;
    }

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
        .values({ providerId, productId, costPerLead: preis })
        .run();
      matched++;
      results.push({ sparte: label, preis, matched: true });
    } else {
      skipped++;
      results.push({ sparte: label, preis, matched: false });
    }
  }

  return NextResponse.json({
    matched,
    skipped,
    total: matched + skipped,
    results,
  });
}
