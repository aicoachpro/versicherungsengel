import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, emailAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { ImapFlow } from "imapflow";

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

export async function POST(
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

  const account = db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .get();
  if (!account) {
    return NextResponse.json({ error: "E-Mail-Konto nicht gefunden" }, { status: 404 });
  }

  try {
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.useSsl,
      auth: {
        user: account.username,
        pass: decrypt(account.password),
      },
      logger: false,
    });

    await client.connect();
    await client.logout();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return NextResponse.json({ ok: false, error: message });
  }
}
