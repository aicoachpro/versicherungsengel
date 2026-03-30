import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

  const result = db
    .select()
    .from(documents)
    .where(eq(documents.leadId, Number(leadId)))
    .orderBy(documents.createdAt)
    .all();

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const leadId = formData.get("leadId") as string | null;
  const typ = (formData.get("typ") as string) || "Sonstiges";

  if (!file || !leadId) {
    return NextResponse.json({ error: "Missing file or leadId" }, { status: 400 });
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]/g, "_");
  const filename = `${leadId}_${timestamp}_${safeName}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const bytes = await file.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(bytes));

  const validTypes = ["Angebot", "Police", "E-Mail", "Sonstiges"] as const;
  const safeTyp = validTypes.includes(typ as typeof validTypes[number])
    ? (typ as typeof validTypes[number])
    : "Sonstiges";

  const result = db.insert(documents).values({
    leadId: Number(leadId),
    name: file.name,
    dateipfad: filename,
    typ: safeTyp,
  }).returning().get();

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const doc = db.select().from(documents).where(eq(documents.id, Number(id))).get();
  if (doc) {
    const filepath = path.join(UPLOAD_DIR, doc.dateipfad);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    db.delete(documents).where(eq(documents.id, Number(id))).run();
  }

  return NextResponse.json({ success: true });
}
