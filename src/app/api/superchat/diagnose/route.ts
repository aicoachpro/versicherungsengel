import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, leads, activities } from "@/db/schema";
import { eq, sql, isNotNull, desc, and, like, or } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();
  if (!user || user.role !== "admin") return null;
  return user;
}

function buildWebhookUrl(req: NextRequest): string {
  const explicit = process.env.PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (explicit) return `${explicit.replace(/\/$/, "")}/api/webhooks/superchat`;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return `${proto}://${host}/api/webhooks/superchat`;
}

/**
 * GET /api/superchat/diagnose
 *
 * Liefert Sichtbarkeit, warum Superchat-Konversationen ggf. nicht automatisch
 * beim Lead dokumentiert werden. Drei Pruefungen:
 *
 *  1. ENV-Variablen vorhanden (API-Key + Webhook-Secret)
 *  2. Wie viele Leads sind mit einer Superchat-Kontakt-ID verknuepft
 *  3. Gibt es ueberhaupt schon Superchat-Activities? Wann zuletzt?
 *
 * Plus die Webhook-URL zum Eintragen ins Superchat-Dashboard.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const envApiKey = Boolean(process.env.SUPERCHAT_API_KEY);
  const envWebhookSecret = Boolean(process.env.SUPERCHAT_WEBHOOK_SECRET);

  const leadsTotalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .get();
  const leadsLinkedRow = db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(isNotNull(leads.superchatContactId))
    .get();

  // Letzte Superchat-Activity: erkennbar an Notiz-Praefix "[Superchat" (siehe webhook/route.ts)
  const lastActivity = db
    .select({
      id: activities.id,
      leadId: activities.leadId,
      datum: activities.datum,
      notiz: activities.notiz,
      leadName: leads.name,
    })
    .from(activities)
    .leftJoin(leads, eq(activities.leadId, leads.id))
    .where(
      and(
        or(
          eq(activities.kontaktart, "WhatsApp"),
          eq(activities.kontaktart, "Telefon"),
          eq(activities.kontaktart, "E-Mail"),
          eq(activities.kontaktart, "Sonstiges"),
        ),
        like(activities.notiz, "[Superchat%"),
      ),
    )
    .orderBy(desc(activities.datum))
    .limit(1)
    .get();

  return NextResponse.json({
    envApiKey,
    envWebhookSecret,
    leadsTotal: leadsTotalRow?.count ?? 0,
    leadsLinked: leadsLinkedRow?.count ?? 0,
    lastInbound: lastActivity
      ? {
          at: lastActivity.datum,
          leadName: lastActivity.leadName,
          leadId: lastActivity.leadId,
        }
      : null,
    webhookUrl: buildWebhookUrl(req),
  });
}
