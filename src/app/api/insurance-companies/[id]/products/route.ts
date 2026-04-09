import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, insuranceCompanies, companyProducts, productMappings } from "@/db/schema";
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

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function detectDelimiter(line: string): string {
  let semiCount = 0;
  let commaCount = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ";") semiCount++;
      else if (ch === ",") commaCount++;
    }
  }
  return semiCount >= commaCount ? ";" : ",";
}

/**
 * GET /api/insurance-companies/[id]/products — Liste aller Produkte dieser Gesellschaft
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const companyId = Number(id);
  if (!companyId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const products = db
    .select()
    .from(companyProducts)
    .where(eq(companyProducts.companyId, companyId))
    .orderBy(sql`${companyProducts.name} ASC`)
    .all();

  return NextResponse.json(products);
}

/**
 * POST /api/insurance-companies/[id]/products
 * Entweder: CSV-Upload (multipart/form-data mit "file")
 * Oder:     Einzelnes Produkt hinzufuegen (JSON { name: string })
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const companyId = Number(id);
  if (!companyId) return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });

  const company = db.select().from(insuranceCompanies).where(eq(insuranceCompanies.id, companyId)).get();
  if (!company) return NextResponse.json({ error: "Gesellschaft nicht gefunden" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  // JSON: Einzelnes Produkt hinzufuegen
  if (contentType.includes("application/json")) {
    const body = await req.json();
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
    }
    const result = db
      .insert(companyProducts)
      .values({ companyId, name: body.name.trim() })
      .returning()
      .get();
    return NextResponse.json(result, { status: 201 });
  }

  // CSV-Upload
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });

  // Datei als Buffer lesen mit Mojibake-Fix
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let text: string;
  try {
    text = buffer.toString("utf-8");
    if (/Ã[¤¶¼ÄÖÜ]|Ã\u009f/.test(text)) {
      text = Buffer.from(text, "latin1").toString("utf-8");
    }
  } catch {
    text = buffer.toString("latin1");
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return NextResponse.json({ error: "Datei ist leer" }, { status: 400 });
  }

  const delimiter = detectDelimiter(lines[0]);

  // Alte Produkte + Mappings loeschen
  const oldProducts = db
    .select({ id: companyProducts.id })
    .from(companyProducts)
    .where(eq(companyProducts.companyId, companyId))
    .all();
  if (oldProducts.length > 0) {
    for (const p of oldProducts) {
      db.delete(productMappings).where(eq(productMappings.companyProductId, p.id)).run();
    }
    db.delete(companyProducts).where(eq(companyProducts.companyId, companyId)).run();
  }

  let inserted = 0;
  const skipped: string[] = [];

  for (const line of lines) {
    if (/^(gesellschaft|company|name|produkt)/i.test(line)) continue;

    const parts = parseCsvLine(line, delimiter);
    // Format: Gesellschaft,Produkt (2 Spalten) oder nur Produkt (1 Spalte)
    const productName = parts.length >= 2 ? parts[1].trim() : parts[0].trim();

    if (!productName) {
      skipped.push("(leer)");
      continue;
    }

    db.insert(companyProducts)
      .values({ companyId, name: productName })
      .run();
    inserted++;
  }

  return NextResponse.json({
    inserted,
    skipped: skipped.length,
    total: inserted + skipped.length,
  });
}
