import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ error: "Passwort erforderlich" }, { status: 400 });
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Falsches Passwort" }, { status: 400 });
  }

  db.update(users)
    .set({ totpEnabled: 0, totpSecret: null })
    .where(eq(users.id, user.id))
    .run();

  return NextResponse.json({ success: true });
}
