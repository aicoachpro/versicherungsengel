import { NextResponse } from "next/server";
import { db } from "@/db";
import { provisionImports } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const imports = db
      .select()
      .from(provisionImports)
      .orderBy(sql`${provisionImports.createdAt} DESC`)
      .limit(50)
      .all();

    return NextResponse.json(imports);
  } catch {
    return NextResponse.json([]);
  }
}
