import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  insuranceCompanies,
  companyProducts,
  productMappings,
  leadProducts,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { matchProductsToLeadSparten } from "@/lib/ai-client";

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
 * POST /api/insurance-companies/[id]/match
 * KI-Matching: Gesellschafts-Produkte → Lead-Sparten
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const companyId = Number(id);
  if (!companyId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const company = db.select().from(insuranceCompanies).where(eq(insuranceCompanies.id, companyId)).get();
  if (!company) return NextResponse.json({ error: "Gesellschaft nicht gefunden" }, { status: 404 });

  // Produkte dieser Gesellschaft laden
  const cProducts = db
    .select()
    .from(companyProducts)
    .where(eq(companyProducts.companyId, companyId))
    .all();

  if (cProducts.length === 0) {
    return NextResponse.json({ error: "Keine Produkte vorhanden. Zuerst Produktliste hochladen." }, { status: 400 });
  }

  // Alle Lead-Produkte laden
  const lProducts = db.select().from(leadProducts).all();

  if (lProducts.length === 0) {
    return NextResponse.json({ error: "Keine Lead-Produkte im System" }, { status: 400 });
  }

  // KI-Matching ausfuehren
  let aiResponse: string;
  try {
    aiResponse = await matchProductsToLeadSparten(
      lProducts.map((p) => ({ id: p.id, name: p.name, kuerzel: p.kuerzel })),
      cProducts.map((p) => ({ id: p.id, name: p.name }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `KI-Matching fehlgeschlagen: ${msg}` }, { status: 500 });
  }

  // JSON parsen
  let parsed: {
    mappings: { companyProductId: number; leadProductId: number; confidence: number }[];
  };
  try {
    parsed = JSON.parse(aiResponse);
  } catch {
    const match = aiResponse.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "KI-Antwort ungueltig" }, { status: 500 });
    }
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
    return NextResponse.json({ error: "KI-Antwort ohne mappings-Array" }, { status: 500 });
  }

  // Nur automatisch generierte Mappings dieser Gesellschaft loeschen (manuell verifizierte behalten)
  const cProductIds = cProducts.map((p) => p.id);
  if (cProductIds.length > 0) {
    db.delete(productMappings)
      .where(inArray(productMappings.companyProductId, cProductIds))
      .run();
  }

  // Mindest-Confidence: Nur sehr gute Mappings automatisch speichern
  const MIN_CONFIDENCE = 0.85;

  // Neue Mappings einfuegen (nur gueltige IDs und Confidence >= Threshold)
  const validCompanyIds = new Set(cProducts.map((p) => p.id));
  const validLeadIds = new Set(lProducts.map((p) => p.id));
  let inserted = 0;
  let rejected = 0;
  for (const m of parsed.mappings) {
    if (!validCompanyIds.has(m.companyProductId) || !validLeadIds.has(m.leadProductId)) continue;
    const conf = m.confidence ?? 0;
    if (conf < MIN_CONFIDENCE) {
      rejected++;
      continue;
    }
    db.insert(productMappings)
      .values({
        companyProductId: m.companyProductId,
        leadProductId: m.leadProductId,
        confidence: conf,
        manuallyVerified: false,
      })
      .run();
    inserted++;
  }

  return NextResponse.json({
    matched: inserted,
    total: cProducts.length,
    unmatched: cProducts.length - inserted,
    rejected,
    minConfidence: MIN_CONFIDENCE,
  });
}
