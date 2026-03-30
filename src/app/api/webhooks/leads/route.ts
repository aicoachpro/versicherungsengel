import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateWebhookRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = validateWebhookRequest(req);
  if (!auth.authorized) return auth.response!;

  const openLeads = db
    .select()
    .from(leads)
    .where(
      eq(leads.phase, "Termin eingegangen")
    )
    .all();

  return NextResponse.json(openLeads);
}

export async function POST(req: NextRequest) {
  const auth = validateWebhookRequest(req);
  if (!auth.authorized) return auth.response!;

  const body = await req.json();

  if (!body.firma) {
    return NextResponse.json(
      { error: "Field 'firma' is required" },
      { status: 400 }
    );
  }

  const result = db
    .insert(leads)
    .values({
      name: body.firma,
      phase: "Termin eingegangen",
      ansprechpartner: body.ansprechpartner || null,
      email: body.email || null,
      telefon: body.telefon || null,
      gewerbeart: body.gewerbeart || null,
      branche: body.branche || null,
      notizen: body.notizen || null,
      terminKosten: body.terminKosten ?? 320,
    })
    .returning()
    .get();

  return NextResponse.json(result, { status: 201 });
}
