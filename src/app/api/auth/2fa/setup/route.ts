import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { getBranding } from "@/lib/branding";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: getBranding().companyName,
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  // Save secret (not yet enabled)
  db.update(users)
    .set({ totpSecret: secret.base32 })
    .where(eq(users.id, user.id))
    .run();

  const otpauthUrl = totp.toString();
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({
    secret: secret.base32,
    qrCode: qrCodeUrl,
  });
}
