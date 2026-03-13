import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Aktuelles Passwort ist falsch" },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(newPassword, 10);
  db.update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, user.id))
    .run();

  return NextResponse.json({ success: true });
}
