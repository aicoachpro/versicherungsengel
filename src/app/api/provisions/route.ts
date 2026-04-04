import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { provisions } from "@/db/schema";
import { eq, desc, and, like, isNull, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const importId = searchParams.get("importId");
  const leadId = searchParams.get("leadId");
  const matched = searchParams.get("matched");
  const month = searchParams.get("month"); // Format: YYYY-MM

  // Filter zusammenbauen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (importId) {
    conditions.push(eq(provisions.importId, Number(importId)));
  }

  if (leadId) {
    conditions.push(eq(provisions.leadId, Number(leadId)));
  }

  if (matched === "true") {
    conditions.push(isNotNull(provisions.leadId));
  } else if (matched === "false") {
    conditions.push(isNull(provisions.leadId));
  }

  if (month) {
    // buchungs_datum ist im Format DD.MM.YYYY — Monat filtern
    // Konvertiere YYYY-MM zu MM.YYYY Pattern für LIKE
    const [year, mon] = month.split("-");
    if (year && mon) {
      conditions.push(like(provisions.buchungsDatum, sql`${"%" + mon + "." + year}`));
    }
  }

  const query = db
    .select()
    .from(provisions)
    .orderBy(desc(provisions.id));

  let result;
  if (conditions.length > 0) {
    result = query.where(and(...conditions)).all();
  } else {
    result = query.all();
  }

  return NextResponse.json(result);
}
