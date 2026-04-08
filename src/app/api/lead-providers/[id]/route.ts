import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadProviders, providerProducts } from "@/db/schema";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const providerId = Number(id);
  if (!providerId) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(leadProviders)
    .where(eq(leadProviders.id, providerId))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "Provider nicht gefunden" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.leadType !== undefined) updates.leadType = body.leadType;
  if (body.minPerMonth !== undefined) updates.minPerMonth = body.minPerMonth;
  if (body.costPerLead !== undefined) updates.costPerLead = body.costPerLead;
  if (body.billingModel !== undefined) updates.billingModel = body.billingModel;
  if (body.carryOver !== undefined) updates.carryOver = body.carryOver;
  if (body.startMonth !== undefined) updates.startMonth = body.startMonth;
  if (body.active !== undefined) updates.active = body.active;

  // Update provider-products junction if productIds provided
  if (Array.isArray(body.productIds)) {
    // Delete existing links
    db.delete(providerProducts)
      .where(eq(providerProducts.providerId, providerId))
      .run();
    // Insert new links with optional prices
    const prices: Record<number, number | null> = body.productPrices || {};
    for (const pid of body.productIds) {
      db.insert(providerProducts)
        .values({
          providerId,
          productId: pid,
          costPerLead: prices[pid] ?? null,
        })
        .run();
    }
  }

  if (Object.keys(updates).length === 0 && !Array.isArray(body.productIds)) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  let result = existing;
  if (Object.keys(updates).length > 0) {
    result = db
      .update(leadProviders)
      .set(updates)
      .where(eq(leadProviders.id, providerId))
      .returning()
      .get();
  }

  // Return with productIds
  const links = db
    .select()
    .from(providerProducts)
    .where(eq(providerProducts.providerId, providerId))
    .all();

  return NextResponse.json({
    ...result,
    productIds: links.map((l) => l.productId),
    productPrices: links.reduce((acc, l) => {
      acc[l.productId] = l.costPerLead ?? null;
      return acc;
    }, {} as Record<number, number | null>),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const providerId = Number(id);
  if (!providerId) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(leadProviders)
    .where(eq(leadProviders.id, providerId))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "Provider nicht gefunden" }, { status: 404 });
  }

  // Soft-Delete: active = false
  const result = db
    .update(leadProviders)
    .set({ active: false })
    .where(eq(leadProviders.id, providerId))
    .returning()
    .get();

  return NextResponse.json(result);
}
