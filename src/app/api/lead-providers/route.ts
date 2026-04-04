import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leadProviders } from "@/db/schema";
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

  const all = db
    .select()
    .from(leadProviders)
    .orderBy(sql`${leadProviders.createdAt} DESC`)
    .all();

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const result = db
    .insert(leadProviders)
    .values({
      name: body.name,
      leadType: body.leadType ?? "",
      minPerMonth: body.minPerMonth ?? 10,
      costPerLead: body.costPerLead ?? 320,
      billingModel: body.billingModel ?? "prepaid",
      carryOver: body.carryOver ?? true,
      startMonth: body.startMonth ?? "",
      active: body.active ?? true,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
