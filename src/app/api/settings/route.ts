import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAllSettingsMasked,
  getSetting,
  setSetting,
  isSecretKey,
} from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(getAllSettingsMasked());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, string> = body;
  let updated = 0;

  for (const [key, value] of Object.entries(updates)) {
    if (typeof key !== "string" || typeof value !== "string") continue;

    // Don't overwrite secrets with masked values
    if (isSecretKey(key) && (value === "***" || value.includes("..."))) {
      continue;
    }

    setSetting(key, value);
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
