import { NextRequest, NextResponse } from "next/server";
import { setWebhook } from "@/lib/telegram";

/**
 * Webhook bei Telegram registrieren.
 * Aufruf: GET /api/webhooks/telegram/setup?secret=<CRON_SECRET>
 * Setzt den Webhook auf: https://<APP_URL>/api/webhooks/telegram
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "AUTH_URL nicht gesetzt" }, { status: 500 });
  }

  const webhookUrl = `${appUrl}/api/webhooks/telegram`;
  const result = await setWebhook(webhookUrl);

  return NextResponse.json({ webhookUrl, telegram: result });
}
