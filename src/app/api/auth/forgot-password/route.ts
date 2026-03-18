import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "E-Mail erforderlich" }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();

  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  }).run();

  const baseUrl = process.env.AUTH_URL || req.nextUrl.origin;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl, user.name);
  } catch (error) {
    console.error("Failed to send reset email:", error);
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
