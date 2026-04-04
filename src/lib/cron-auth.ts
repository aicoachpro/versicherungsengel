import { NextRequest } from "next/server";

/**
 * Verifiziert die Cron-Authentifizierung via Bearer-Token oder Query-Param.
 * CRON_SECRET muss als Umgebungsvariable gesetzt sein — ohne Secret wird IMMER abgelehnt.
 */
export function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Kein Secret konfiguriert → Zugriff verweigern (fail-closed)
  if (!secret) return false;

  // Option 1: Authorization Header mit Bearer Token
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Option 2: Legacy Query-Param (Abwaertskompatibilitaet)
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === secret) return true;

  return false;
}
