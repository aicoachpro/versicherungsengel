import { NextResponse } from "next/server";
import { getBranding } from "@/lib/branding";

// Public route — no auth needed, returns non-sensitive branding info
export async function GET() {
  return NextResponse.json(getBranding());
}
