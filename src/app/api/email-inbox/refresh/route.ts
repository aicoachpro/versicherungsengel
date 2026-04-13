import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/email-inbox/refresh
 * Forciert einen vollstaendigen Abholvorgang: Poll + Process.
 * Wird vom "Aktualisieren"-Button im E-Mail-Eingang getriggert.
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET || "vf-cron-2024-secure";

  // Poll-Ergebnis (force-Modus, 2 Tage Rueckblick)
  let pollResult: unknown = null;
  let pollError: string | null = null;
  try {
    const pollRes = await fetch(
      `${baseUrl}/api/cron/mail-poll?secret=${secret}&force=1&days=2`,
      { method: "GET" },
    );
    pollResult = await pollRes.json().catch(() => ({}));
  } catch (err) {
    pollError = err instanceof Error ? err.message : String(err);
  }

  // Process-Ergebnis: KI-Extraktion fuer pendente Mails
  let processResult: unknown = null;
  let processError: string | null = null;
  try {
    const procRes = await fetch(
      `${baseUrl}/api/cron/mail-process?secret=${secret}`,
      { method: "GET" },
    );
    processResult = await procRes.json().catch(() => ({}));
  } catch (err) {
    processError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    success: !pollError && !processError,
    poll: pollResult,
    process: processResult,
    errors: [pollError, processError].filter(Boolean),
  });
}
