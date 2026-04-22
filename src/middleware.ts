import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublicPage = pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/verify-2fa";
  const isWebhook = pathname.startsWith("/api/webhooks");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isIngestApi = pathname.startsWith("/api/leads/ingest") || pathname.startsWith("/api/activities/ingest");
  const isSearchApi = pathname.startsWith("/api/leads/search");
  const isExportApi = pathname.startsWith("/api/export");
  const isCronApi = pathname.startsWith("/api/cron");

  // API-Aufrufe mit gueltigem Cron-Secret duerfen die Middleware umgehen
  // (mail-process ruft /api/superchat/sync intern auf)
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET || "vf-cron-2024-secure";
  const isInternalCronCall = pathname.startsWith("/api/") && cronSecret === expected;

  if (isWebhook || isAuthApi || isIngestApi || isSearchApi || isExportApi || isCronApi || isInternalCronCall) {
    return NextResponse.next();
  }

  const secureCookie = req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: secureCookie
      ? "__Secure-authjs.session-token"
      : "authjs.session-token",
  });
  const isLoggedIn = !!token;

  if (!isLoggedIn && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|uploads/).*)"],
};
