import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, emailAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const PASSWORD_MASK = "********";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const accountId = Number(id);
  if (!accountId) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.imapHost !== undefined) updates.imapHost = body.imapHost;
  if (body.imapPort !== undefined) updates.imapPort = body.imapPort;
  if (body.useSsl !== undefined) updates.useSsl = body.useSsl;
  if (body.username !== undefined) updates.username = body.username;
  // Only update password if it's not the masked value
  if (body.password !== undefined && body.password !== PASSWORD_MASK) {
    updates.password = body.password;
  }
  if (body.folder !== undefined) updates.folder = body.folder;
  if (body.active !== undefined) updates.active = body.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Aenderungen" }, { status: 400 });
  }

  const result = db
    .update(emailAccounts)
    .set(updates)
    .where(eq(emailAccounts.id, accountId))
    .returning()
    .get();

  return NextResponse.json({ ...result, password: PASSWORD_MASK });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const accountId = Number(id);
  if (!accountId) {
    return NextResponse.json({ error: "Ungueltige ID" }, { status: 400 });
  }

  const existing = db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .get();
  if (!existing) {
    return NextResponse.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  db.delete(emailAccounts).where(eq(emailAccounts.id, accountId)).run();

  return NextResponse.json({ ok: true });
}
