import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { produkte } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kategorie = searchParams.get("kategorie");

  if (kategorie) {
    const result = db
      .select()
      .from(produkte)
      .where(eq(produkte.kategorie, kategorie as "fremdvertrag" | "cross_selling"))
      .orderBy(produkte.name)
      .all();
    return NextResponse.json(result);
  }

  const all = db.select().from(produkte).orderBy(produkte.name).all();
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name || !body.kategorie) {
    return NextResponse.json({ error: "Missing name or kategorie" }, { status: 400 });
  }

  // Check for duplicate
  const existing = db
    .select()
    .from(produkte)
    .where(and(eq(produkte.name, body.name), eq(produkte.kategorie, body.kategorie)))
    .get();

  if (existing) {
    return NextResponse.json(existing);
  }

  const result = db
    .insert(produkte)
    .values({
      name: body.name,
      kategorie: body.kategorie,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
