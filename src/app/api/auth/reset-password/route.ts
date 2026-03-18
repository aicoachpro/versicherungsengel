import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token und Passwort erforderlich" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
  }

  const resetToken = db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), isNull(passwordResetTokens.usedAt)))
    .get();

  if (!resetToken) {
    return NextResponse.json({ error: "Ungültiger oder bereits verwendeter Link" }, { status: 400 });
  }

  if (new Date(resetToken.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Der Link ist abgelaufen. Bitte fordere einen neuen an." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);

  db.update(users).set({ passwordHash: hash }).where(eq(users.id, resetToken.userId)).run();
  db.update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordResetTokens.id, resetToken.id))
    .run();

  return NextResponse.json({ success: true });
}
