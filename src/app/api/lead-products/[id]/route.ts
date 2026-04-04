import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadProducts } from "@/db/schema";
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
  const productId = Number(id);
  if (!productId) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(leadProducts)
    .where(eq(leadProducts.id, productId))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.active !== undefined) updates.active = body.active;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Aenderungen" }, { status: 400 });
  }

  const result = db
    .update(leadProducts)
    .set(updates)
    .where(eq(leadProducts.id, productId))
    .returning()
    .get();

  return NextResponse.json(result);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const productId = Number(id);
  if (!productId) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(leadProducts)
    .where(eq(leadProducts.id, productId))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
  }

  // Soft-Delete: active = false
  const result = db
    .update(leadProducts)
    .set({ active: false })
    .where(eq(leadProducts.id, productId))
    .returning()
    .get();

  return NextResponse.json(result);
}
