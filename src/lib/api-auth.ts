import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "./rate-limit";

interface ApiAuthResult {
  authorized: boolean;
  response?: NextResponse;
  apiKeyName?: string;
}

/**
 * Validiert API-Key (Bearer Token) und prüft Rate-Limit.
 * Gibt bei Fehler eine fertige NextResponse zurück.
 */
export function validateApiRequest(
  req: NextRequest,
  { maxRequests = 60, windowMs = 60_000 } = {}
): ApiAuthResult {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "API-Key erforderlich (Authorization: Bearer <key>)" },
        { status: 401 }
      ),
    };
  }

  const key = authHeader.replace("Bearer ", "");
  const validKey = db.select().from(apiKeys).where(eq(apiKeys.key, key)).get();
  if (!validKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Ungültiger API-Key" },
        { status: 401 }
      ),
    };
  }

  // Rate-Limit prüfen
  const limit = checkRateLimit(key, maxRequests, windowMs);
  if (!limit.allowed) {
    const retryAfterSec = Math.ceil(limit.retryAfterMs / 1000);
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Rate-Limit überschritten",
          retryAfterSeconds: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Remaining": "0",
          },
        }
      ),
    };
  }

  return { authorized: true, apiKeyName: validKey.name };
}

/**
 * Validiert API-Key über x-api-key Header (für Webhook-Routen).
 */
export function validateWebhookRequest(
  req: NextRequest,
  { maxRequests = 60, windowMs = 60_000 } = {}
): ApiAuthResult {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "API-Key erforderlich (x-api-key Header)" },
        { status: 401 }
      ),
    };
  }

  const validKey = db.select().from(apiKeys).where(eq(apiKeys.key, apiKey)).get();
  if (!validKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Ungültiger API-Key" },
        { status: 401 }
      ),
    };
  }

  const limit = checkRateLimit(apiKey, maxRequests, windowMs);
  if (!limit.allowed) {
    const retryAfterSec = Math.ceil(limit.retryAfterMs / 1000);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Rate-Limit überschritten", retryAfterSeconds: retryAfterSec },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      ),
    };
  }

  return { authorized: true, apiKeyName: validKey.name };
}
