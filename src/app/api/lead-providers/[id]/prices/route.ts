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

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  // Alle Lead-Produkte laden fuer Matching
  const allProducts = db.select().from(leadProducts).all();

  // Maps fuer schnelles Matching
  const byKuerzel = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const p of allProducts) {
    if (p.kuerzel) byKuerzel.set(p.kuerzel.toLowerCase(), p.id);
    byName.set(p.name.toLowerCase().trim(), p.id);
  }

  let matched = 0;
  let skipped = 0;
  const results: { sparte: string; preis: number; matched: boolean }[] = [];

  // Bestehende Links loeschen und neu aufbauen
  db.delete(providerProducts).where(eq(providerProducts.providerId, providerId)).run();

  // Format erkennen: Hat die erste Datenzeile 3 Spalten? (Kuerzel;Name;Preis)
  const firstDataLine = lines.find((l) => !/^(kuerzel|sparte|produkt|name)/i.test(l));
  const semis = (firstDataLine || "").split(";").length;
  const isThreeCol = semis >= 3;

  for (const line of lines) {
    // Header-Zeile ueberspringen
    if (/^(kuerzel|sparte|produkt|name)/i.test(line)) continue;

    const parts = line.split(";");
    let kuerzel = "";
    let sparte = "";
    let preisRaw = "";

    if (isThreeCol && parts.length >= 3) {
      // Format: Kuerzel;Produktbezeichnung;Preis (Check-Direkt)
      kuerzel = parts[0].trim();
      sparte = parts[1].trim();
      preisRaw = parts.slice(2).join(";"); // Preis kann Komma in Anfuehrungszeichen haben
    } else if (parts.length >= 2) {
      // Format: Sparte;Preis
      sparte = parts[0].trim();
      preisRaw = parts.slice(1).join(";");
    } else {
      continue;
    }

    const preis = parsePrice(preisRaw);

    if (!sparte && !kuerzel) {
      results.push({ sparte: "(leer)", preis: 0, matched: false });
      skipped++;
      continue;
    }

    // Matching-Reihenfolge:
    // 1. Exakt nach Kuerzel
    // 2. Exakt nach Name
    // 3. Teilstring-Match nach Name
    let productId: number | undefined;

    if (kuerzel) {
      productId = byKuerzel.get(kuerzel.toLowerCase());
    }
    if (!productId && sparte) {
      productId = byName.get(sparte.toLowerCase());
    }
    if (!productId && sparte) {
      const sparteLower = sparte.toLowerCase();
      for (const [name, pid] of byName.entries()) {
        if (name.includes(sparteLower) || sparteLower.includes(name)) {
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
