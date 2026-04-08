import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inboundEmails } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Nur Admins duerfen den E-Mail-Eingang sehen
  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const emails = db
    .select()
    .from(inboundEmails)
    .orderBy(sql`${inboundEmails.receivedAt} DESC`)
    .limit(100)
    .all();

  return NextResponse.json(emails);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    db.delete(inboundEmails).where(eq(inboundEmails.id, Number(id))).run();
  } else {
    // Alle löschen
    db.delete(inboundEmails).run();
  }

  return NextResponse.json({ success: true });
}
