import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadProducts, providerProducts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

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

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = db
    .select()
    .from(leadProducts)
    .orderBy(sql`${leadProducts.sortOrder} ASC`)
    .all();

  // Markiere Produkte als 'purchased' wenn sie bei irgendeinem Anbieter gekauft werden
  let purchasedSet = new Set<number>();
  try {
    const purchased = db
      .select({ productId: providerProducts.productId })
      .from(providerProducts)
      .where(eq(providerProducts.purchased, true))
      .all();
    purchasedSet = new Set(purchased.map((p) => p.productId));
  } catch {
    // Tabelle evtl. noch nicht migriert
  }

  const result = all.map((p) => ({
    ...p,
    purchased: purchasedSet.has(p.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const result = db
    .insert(leadProducts)
    .values({
      name: body.name,
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
