import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, companyProducts, productMappings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
 * DELETE /api/insurance-companies/[id]/products/[productId]
 * Loescht ein einzelnes Gesellschafts-Produkt (und sein Mapping).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id, productId } = await params;
  const companyId = Number(id);
  const cpId = Number(productId);
  if (!companyId || !cpId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  // Verifizieren dass Produkt zu dieser Gesellschaft gehoert
  const cp = db
    .select()
    .from(companyProducts)
    .where(and(eq(companyProducts.id, cpId), eq(companyProducts.companyId, companyId)))
    .get();
  if (!cp) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  // Mapping und Produkt loeschen
  db.delete(productMappings).where(eq(productMappings.companyProductId, cpId)).run();
  db.delete(companyProducts).where(eq(companyProducts.id, cpId)).run();

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/insurance-companies/[id]/products/[productId]
 * Aendert den Namen eines Produkts.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id, productId } = await params;
  const companyId = Number(id);
  const cpId = Number(productId);
  if (!companyId || !cpId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }

  const cp = db
    .select()
    .from(companyProducts)
    .where(and(eq(companyProducts.id, cpId), eq(companyProducts.companyId, companyId)))
    .get();
  if (!cp) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  const result = db
    .update(companyProducts)
    .set({ name: body.name.trim() })
    .where(eq(companyProducts.id, cpId))
    .returning()
    .get();

  return NextResponse.json(result);
}
