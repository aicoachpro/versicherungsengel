import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublicPage = pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/verify-2fa";
  const isWebhook = pathname.startsWith("/api/webhooks");
  const isAuthApi = pathname.startsWith("/api/auth");

  if (isWebhook || isAuthApi) return NextResponse.next();

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
