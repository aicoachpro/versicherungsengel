import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testConnection } from "@/lib/ai-client";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
  }

  const result = await testConnection();
  return NextResponse.json(result);
}
