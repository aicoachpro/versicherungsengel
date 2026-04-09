import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  companyProducts,
  productMappings,
  leadProducts,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
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
 * GET /api/insurance-companies/[id]/mappings
 * Liefert alle Gesellschafts-Produkte dieser Gesellschaft mit ihren Lead-Mappings.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const companyId = Number(id);
  if (!companyId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const cProducts = db
    .select()
    .from(companyProducts)
    .where(eq(companyProducts.companyId, companyId))
    .all();

  if (cProducts.length === 0) return NextResponse.json([]);

  const cProductIds = cProducts.map((p) => p.id);
  const mappings = db
    .select()
    .from(productMappings)
    .where(inArray(productMappings.companyProductId, cProductIds))
    .all();

  const lProducts = db.select().from(leadProducts).all();
  const lProductMap = new Map(lProducts.map((p) => [p.id, p]));

  const result = cProducts.map((cp) => {
    const m = mappings.find((map) => map.companyProductId === cp.id);
    const lp = m ? lProductMap.get(m.leadProductId) : null;
    return {
      companyProductId: cp.id,
      companyProductName: cp.name,
      leadProductId: m?.leadProductId || null,
      leadProductName: lp?.name || null,
      leadProductKuerzel: lp?.kuerzel || null,
      confidence: m?.confidence || null,
      manuallyVerified: m?.manuallyVerified || false,
    };
  });

  return NextResponse.json(result);
}

/**
 * PATCH /api/insurance-companies/[id]/mappings
 * Body: { companyProductId, leadProductId | null }
 * Manuelles Update eines Mappings.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const companyId = Number(id);
  if (!companyId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const body = await req.json();
  const { companyProductId, leadProductId } = body;
  if (!companyProductId) {
    return NextResponse.json({ error: "companyProductId fehlt" }, { status: 400 });
  }

  // Verifizieren dass das companyProduct zu dieser Gesellschaft gehoert
  const cp = db.select().from(companyProducts).where(eq(companyProducts.id, companyProductId)).get();
  if (!cp || cp.companyId !== companyId) {
    return NextResponse.json({ error: "Produkt gehoert nicht zu dieser Gesellschaft" }, { status: 400 });
  }

  // Bestehendes Mapping loeschen
  db.delete(productMappings).where(eq(productMappings.companyProductId, companyProductId)).run();

  // Neues Mapping einfuegen (wenn leadProductId gesetzt)
  if (leadProductId) {
    db.insert(productMappings)
      .values({
        companyProductId,
        leadProductId,
        confidence: 1.0,
        manuallyVerified: true,
      })
      .run();
  }

  return NextResponse.json({ ok: true });
}
