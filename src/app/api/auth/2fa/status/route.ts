import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();

  return NextResponse.json({ enabled: !!user?.totpEnabled });
}
