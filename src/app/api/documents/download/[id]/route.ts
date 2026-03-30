import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import path from "path";
import fs from "fs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = db.select().from(documents).where(eq(documents.id, Number(id))).get();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filepath = path.join(process.cwd(), "data", "uploads", doc.dateipfad);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filepath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${doc.name}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
