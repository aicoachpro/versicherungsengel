import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import * as OTPAuth from "otpauth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code erforderlich" }, { status: 400 });
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();

  if (!user?.totpSecret) {
    return NextResponse.json({ error: "2FA nicht eingerichtet" }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer: "VÖLKER Finance",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.totpSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });

  if (delta === null) {
    return NextResponse.json({ error: "Ungültiger Code" }, { status: 400 });
  }

  // Enable 2FA
  db.update(users)
    .set({ totpEnabled: 1 })
    .where(eq(users.id, user.id))
    .run();

  return NextResponse.json({ success: true });
}
