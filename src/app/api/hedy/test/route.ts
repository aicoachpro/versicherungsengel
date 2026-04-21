import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { HedyClient } from "@/lib/hedy/client";
import type { HedyRegion } from "@/lib/hedy/types";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = getSetting("hedy.apiKey");
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "API-Key nicht gesetzt" });
  }

  const region = (getSetting("hedy.region") || "eu") as HedyRegion;
  const client = new HedyClient({ apiKey, region });
  const result = await client.testConnection();
  return NextResponse.json(result);
}
