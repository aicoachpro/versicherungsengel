import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allLeads = db.select().from(leads).orderBy(sql`${leads.updatedAt} DESC`).all();
  return NextResponse.json(allLeads);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = db.insert(leads).values({
    name: body.name,
    phase: body.phase || "Termin eingegangen",
    termin: body.termin || null,
    ansprechpartner: body.ansprechpartner || null,
    email: body.email || null,
    telefon: body.telefon || null,
    website: body.website || null,
    gewerbeart: body.gewerbeart || null,
    branche: body.branche || null,
    unternehmensgroesse: body.unternehmensgroesse || null,
    umsatzklasse: body.umsatzklasse || null,
    terminKosten: body.terminKosten ?? 320,
    umsatz: body.umsatz || null,
    conversion: body.conversion || null,
    naechsterSchritt: body.naechsterSchritt || null,
    notizen: body.notizen || null,
    eingangsdatum: body.eingangsdatum || new Date().toISOString().split("T")[0],
    folgetermin: body.folgetermin || null,
  }).returning().get();

  const { userId, userName } = getAuditUser(session);
  logAudit({ userId, userName, action: "create", entity: "lead", entityId: result.id, entityName: result.name });

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { id, ...updates } = body;
  updates.updatedAt = new Date().toISOString();

  // Wenn Folgetermin geändert wird, Benachrichtigungs-Flag zurücksetzen
  if ("folgetermin" in updates) {
    updates.folgeterminNotified = 0;
  }

  const result = db
    .update(leads)
    .set(updates)
    .where(eq(leads.id, id))
    .returning()
    .get();

  if (updates.phase === "Abgeschlossen" || updates.phase === "Verloren") {
    createNotification({
      type: "phase_change",
      title: updates.phase === "Abgeschlossen" ? "Lead abgeschlossen" : "Lead verloren",
      message: result?.name || `Lead #${id}`,
      entityId: id,
    });
  }

  const { userId, userName } = getAuditUser(session);
  logAudit({ userId, userName, action: "update", entity: "lead", entityId: id, entityName: result?.name, changes: updates });

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const lead = db.select({ name: leads.name }).from(leads).where(eq(leads.id, Number(id))).get();
  db.delete(leads).where(eq(leads.id, Number(id))).run();

  const { userId, userName } = getAuditUser(session);
  logAudit({ userId, userName, action: "delete", entity: "lead", entityId: Number(id), entityName: lead?.name });

  return NextResponse.json({ success: true });
}
