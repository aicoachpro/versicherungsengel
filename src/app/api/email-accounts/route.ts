import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, emailAccounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const all = db
    .select()
    .from(emailAccounts)
    .orderBy(sql`${emailAccounts.createdAt} DESC`)
    .all();

  // Mask passwords
  const masked = all.map((a) => ({ ...a, password: PASSWORD_MASK }));

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.imapHost || !body.username || !body.password) {
    return NextResponse.json(
      { error: "Name, IMAP-Host, Benutzername und Passwort sind erforderlich" },
      { status: 400 }
    );
  }

  const result = db
    .insert(emailAccounts)
    .values({
      name: body.name,
      imapHost: body.imapHost,
      imapPort: body.imapPort ?? 993,
      useSsl: body.useSsl ?? true,
      username: body.username,
      password: encrypt(body.password),
      folder: body.folder ?? "INBOX",
      active: body.active ?? true,
    })
    .returning()
    .get();

  return NextResponse.json({ ...result, password: PASSWORD_MASK }, { status: 201 });
}
