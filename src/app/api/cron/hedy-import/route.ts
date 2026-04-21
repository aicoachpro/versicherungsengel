import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getSetting, setSetting } from "@/lib/settings";
import { runImport } from "@/lib/hedy/import";

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getSetting("hedy.autoImport") !== "true") {
    return NextResponse.json({ ok: true, skipped: true, reason: "Auto-Import deaktiviert" });
  }

  if (!getSetting("hedy.apiKey")) {
    return NextResponse.json({ ok: false, error: "Hedy API-Key nicht konfiguriert" }, { status: 412 });
  }

  try {
    const result = await runImport({ limit: 50 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = (err as Error).message;
    setSetting("hedy.lastImportAt", new Date().toISOString());
    setSetting("hedy.lastImportStatus", "error");
    setSetting("hedy.lastImportMessage", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
