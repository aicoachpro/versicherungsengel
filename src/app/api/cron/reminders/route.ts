import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { sendPushoverNotification } from "@/lib/pushover";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  // Einfache Absicherung per Secret-Header oder Query-Param
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  // Folgetermine die in der nächsten Stunde liegen und noch nicht benachrichtigt wurden
  const upcoming = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      folgetermin: leads.folgetermin,
    })
    .from(leads)
    .where(
      and(
        gte(leads.folgetermin, now.toISOString()),
        lte(leads.folgetermin, inOneHour.toISOString()),
        eq(leads.folgeterminNotified, 0)
      )
    )
    .all();

  let sent = 0;

  for (const lead of upcoming) {
    const terminDate = new Date(lead.folgetermin!);
    const zeitStr = terminDate.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const success = await sendPushoverNotification({
      title: "🗓 Folgetermin in 1 Stunde",
      message: `${lead.name}${lead.ansprechpartner ? ` (${lead.ansprechpartner})` : ""} — ${zeitStr}`,
    });

    createNotification({
      type: "folgetermin",
      title: "Folgetermin in 1 Stunde",
      message: `${lead.name}${lead.ansprechpartner ? ` (${lead.ansprechpartner})` : ""} — ${zeitStr}`,
      entityId: lead.id,
    });

    if (success) {
      db.update(leads)
        .set({ folgeterminNotified: 1 })
        .where(eq(leads.id, lead.id))
        .run();
      sent++;
    }
  }

  return NextResponse.json({ checked: upcoming.length, sent });
}
