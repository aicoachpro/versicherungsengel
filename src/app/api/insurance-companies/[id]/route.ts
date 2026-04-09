import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, insuranceCompanies, companyProducts, productMappings } from "@/db/schema";
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
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.active !== undefined) updates.active = body.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Aenderungen" }, { status: 400 });
  }

  const result = db
    .update(insuranceCompanies)
    .set(updates)
    .where(eq(insuranceCompanies.id, companyId))
    .returning()
    .get();

  return NextResponse.json(result);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const companyId = Number(id);
  if (!companyId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  // Cascade: Erst Mappings loeschen, dann Produkte, dann Gesellschaft
  const products = db
    .select({ id: companyProducts.id })
    .from(companyProducts)
    .where(eq(companyProducts.companyId, companyId))
    .all();

  if (products.length > 0) {
    const productIds = products.map((p) => p.id);
    db.delete(productMappings).where(inArray(productMappings.companyProductId, productIds)).run();
    db.delete(companyProducts).where(eq(companyProducts.companyId, companyId)).run();
  }

  db.delete(insuranceCompanies).where(eq(insuranceCompanies.id, companyId)).run();

  return NextResponse.json({ ok: true });
}
