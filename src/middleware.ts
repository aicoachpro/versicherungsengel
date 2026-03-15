import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isWebhook = req.nextUrl.pathname.startsWith("/api/webhooks");
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");

  if (isWebhook || isAuthApi) return NextResponse.next();

  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
