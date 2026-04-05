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

    // Felder auf UI-Interface mappen
    const mapped = imports.map((imp) => ({
      id: imp.id,
      filename: imp.filename,
      importedAt: imp.importDate,
      rowCount: imp.totalRows,
      totalAmount: imp.totalBetrag,
      matchedCount: imp.matchedRows,
      unmatchedCount: imp.unmatchedRows,
      skippedCount: imp.skippedRows ?? 0,
    }));

    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json([]);
  }
}
