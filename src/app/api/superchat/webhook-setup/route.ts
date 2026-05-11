import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { listWebhooks, createWebhook, deleteWebhook } from "@/lib/superchat";

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

interface NormalizedWebhook {
  id: string;
  targetUrl: string;
  events: string[];
  matchesOurEndpoint: boolean;
}

function normalize(raw: Record<string, unknown>, ourUrl: string): NormalizedWebhook | null {
  const id = (raw.id as string) || (raw.webhook_id as string);
  const targetUrl =
    (raw.target_url as string) || (raw.targetUrl as string) || (raw.url as string) || "";
  if (!id || !targetUrl) return null;

  const rawEvents = (raw.events as Array<unknown>) || [];
  const events = rawEvents
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        const obj = e as Record<string, unknown>;
        return (obj.type as string) || (obj.name as string) || "";
      }
      return "";
    })
    .filter(Boolean);

  return {
    id,
    targetUrl,
    events,
    matchesOurEndpoint: targetUrl.replace(/\/$/, "") === ourUrl.replace(/\/$/, ""),
  };
}

/**
 * GET /api/superchat/webhook-setup
 * Listet alle bei Superchat registrierten Webhooks. Markiert den, dessen
 * target_url unsere Webhook-URL ist.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (!process.env.SUPERCHAT_API_KEY) {
    return NextResponse.json(
      { error: "SUPERCHAT_API_KEY nicht gesetzt — bitte in der .env eintragen" },
      { status: 400 },
    );
  }

  const ourUrl = buildWebhookUrl(req);

  try {
    const raw = await listWebhooks();
    const webhooks = raw
      .map((w) => normalize(w, ourUrl))
      .filter((w): w is NormalizedWebhook => w !== null);
    const ours = webhooks.find((w) => w.matchesOurEndpoint) || null;

    return NextResponse.json({
      webhookUrl: ourUrl,
      registered: !!ours,
      ours,
      all: webhooks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Superchat API Fehler: ${message}` }, { status: 502 });
  }
}

/**
 * POST /api/superchat/webhook-setup[?force=true]
 *
 * Ohne force: idempotent — wenn schon ein Webhook mit unserer URL existiert,
 * wird kein neuer erstellt.
 *
 * Mit force=true: loescht zuerst ALLE Webhooks mit unserer target_url und
 * erstellt dann frisch — Use Case: Signing Secret ist verloren gegangen oder
 * passt nicht mehr, ein neuer Webhook muss her, der ein frisches Secret liefert.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (!process.env.SUPERCHAT_API_KEY) {
    return NextResponse.json(
      { error: "SUPERCHAT_API_KEY nicht gesetzt — bitte in der .env eintragen" },
      { status: 400 },
    );
  }

  const force = new URL(req.url).searchParams.get("force") === "true";
  const ourUrl = buildWebhookUrl(req);

  try {
    const existing = await listWebhooks();
    const matching = existing
      .map((w) => normalize(w, ourUrl))
      .filter((w): w is NormalizedWebhook => !!w && w.matchesOurEndpoint);

    if (force && matching.length > 0) {
      for (const w of matching) {
        try {
          await deleteWebhook(w.id);
        } catch {
          // wenn delete fehlschlaegt, weitermachen — Superchat darf evtl. mehrere
        }
      }
    } else if (matching.length > 0) {
      return NextResponse.json({
        created: false,
        alreadyRegistered: true,
        webhook: matching[0],
        webhookUrl: ourUrl,
      });
    }

    const created = await createWebhook({
      targetUrl: ourUrl,
      events: ["message_inbound"],
    });

    const signingSecret =
      (created.signing_secret as string) ||
      (created.secret as string) ||
      (created.signingSecret as string) ||
      null;

    return NextResponse.json(
      {
        created: true,
        alreadyRegistered: false,
        replaced: force && matching.length > 0,
        webhook: normalize(created, ourUrl),
        signingSecret,
        webhookUrl: ourUrl,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Superchat API Fehler: ${message}` }, { status: 502 });
  }
}

/**
 * DELETE /api/superchat/webhook-setup?id=...
 * Entfernt einen Webhook bei Superchat (z.B. fuer Re-Registrierung mit neuer URL).
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id Parameter fehlt" }, { status: 400 });

  try {
    await deleteWebhook(id);
    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Superchat API Fehler: ${message}` }, { status: 502 });
  }
}
