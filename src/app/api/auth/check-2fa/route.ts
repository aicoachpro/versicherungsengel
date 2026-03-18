import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Credentials required" }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return NextResponse.json({ requires2fa: false });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ requires2fa: false });
  }

  return NextResponse.json({ requires2fa: !!user.totpEnabled });
}
