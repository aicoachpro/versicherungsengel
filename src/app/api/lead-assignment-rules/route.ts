import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadAssignmentRules, leadProviders, leadProducts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const rules = db
    .select()
    .from(leadAssignmentRules)
    .orderBy(sql`${leadAssignmentRules.providerId} ASC, ${leadAssignmentRules.productId} ASC NULLS FIRST`)
    .all();

  // Enrich with provider name, product name, user name
  const allProviders = db.select().from(leadProviders).all();
  const allProducts = db.select().from(leadProducts).all();
  const allUsers = db.select({ id: users.id, name: users.name }).from(users).all();

  const enriched = rules.map((r) => ({
    ...r,
    // null = Regel gilt fuer alle Anbieter (Pauschal-Leadart-Regel)
    providerName: r.providerId ? allProviders.find((p) => p.id === r.providerId)?.name || "Unbekannt" : null,
    productName: r.productId ? allProducts.find((p) => p.id === r.productId)?.name || "Unbekannt" : null,
    userName: allUsers.find((u) => u.id === r.userId)?.name || "Unbekannt",
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (!body.userId) {
    return NextResponse.json(
      { error: "Bearbeiter ist erforderlich" },
      { status: 400 }
    );
  }
  if (!body.providerId && !body.productId) {
    return NextResponse.json(
      { error: "Mindestens Anbieter ODER Leadart angeben" },
      { status: 400 }
    );
  }

  const result = db
    .insert(leadAssignmentRules)
    .values({
      providerId: body.providerId || null,
      productId: body.productId || null,
      userId: body.userId,
      active: body.active ?? true,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
