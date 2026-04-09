import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, insuranceCompanies, companyProducts } from "@/db/schema";
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

  const companies = db
    .select()
    .from(insuranceCompanies)
    .orderBy(sql`${insuranceCompanies.name} ASC`)
    .all();

  // Produkt-Count pro Gesellschaft
  const allProducts = db.select().from(companyProducts).all();
  const result = companies.map((c) => ({
    ...c,
    productCount: allProducts.filter((p) => p.companyId === c.id).length,
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
    .insert(insuranceCompanies)
    .values({
      name: body.name,
      active: body.active ?? true,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
