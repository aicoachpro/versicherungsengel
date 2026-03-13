import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isWebhook = req.nextUrl.pathname.startsWith("/api/webhooks");
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");

  if (isWebhook || isAuthApi) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
