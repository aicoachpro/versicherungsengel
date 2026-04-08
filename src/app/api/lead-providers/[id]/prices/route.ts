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
 * POST /api/lead-providers/[id]/prices
 * CSV-Upload fuer Preisliste: "Sparte;Preis" (Semikolon-getrennt)
 * Matched Sparten gegen lead_products.name und setzt cost_per_lead
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
  const productMap = new Map<string, number>();
  for (const p of allProducts) {
    productMap.set(p.name.toLowerCase().trim(), p.id);
  }

  let matched = 0;
  let skipped = 0;
  const results: { sparte: string; preis: number; matched: boolean }[] = [];

  // Bestehende Links loeschen und neu aufbauen
  db.delete(providerProducts).where(eq(providerProducts.providerId, providerId)).run();

  for (const line of lines) {
    // Header-Zeile ueberspringen
    if (/^(sparte|produkt|name)/i.test(line)) continue;

    // Semikolon oder Komma als Trenner
    const parts = line.includes(";") ? line.split(";") : line.split(",");
    if (parts.length < 2) continue;

    const sparte = parts[0].trim();
    const preisStr = parts[1].trim().replace(",", ".").replace(/[^\d.]/g, "");
    const preis = parseFloat(preisStr);

    if (!sparte || isNaN(preis)) {
      results.push({ sparte: sparte || "(leer)", preis: 0, matched: false });
      skipped++;
      continue;
    }

    // Fuzzy-Matching: exakt oder enthaltend
    let productId = productMap.get(sparte.toLowerCase());
    if (!productId) {
      // Teilstring-Match
      for (const [name, pid] of productMap.entries()) {
        if (name.includes(sparte.toLowerCase()) || sparte.toLowerCase().includes(name)) {
          productId = pid;
          break;
        }
      }
    }

    if (productId) {
      db.insert(providerProducts)
        .values({ providerId, productId, costPerLead: preis })
        .run();
      matched++;
      results.push({ sparte, preis, matched: true });
    } else {
      skipped++;
      results.push({ sparte, preis, matched: false });
    }
  }

  return NextResponse.json({
    matched,
    skipped,
    total: matched + skipped,
    results,
  });
}
