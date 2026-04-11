import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities, documents, insurances, provisions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as { role?: string })?.role || "user";
  const currentUserId = session.user?.id ? parseInt(session.user.id) : null;
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("showAll");

  // Admin sieht standardmaessig alle; normale User nur eigene + unzugewiesene
  const isAdmin = userRole === "admin";
  const shouldFilter = !isAdmin || showAll === "0";

  let allLeads;
  if (shouldFilter && currentUserId !== null) {
    allLeads = db
      .select()
      .from(leads)
      .where(sql`(${leads.assignedTo} = ${currentUserId} OR ${leads.assignedTo} IS NULL)`)
      .orderBy(sql`${leads.updatedAt} DESC`)
      .all();
  } else {
    allLeads = db.select().from(leads).orderBy(sql`${leads.updatedAt} DESC`).all();
  }
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
    providerId: body.providerId || null,
    assignedTo: body.assignedTo || null,
    productId: body.productId || null,
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

  const leadId = Number(id);
  const lead = db.select({ name: leads.name }).from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    // Abhängige Daten zuerst löschen
    db.delete(activities).where(eq(activities.leadId, leadId)).run();
    db.delete(documents).where(eq(documents.leadId, leadId)).run();
    db.update(insurances).set({ leadId: null }).where(eq(insurances.leadId, leadId)).run();
    db.update(provisions).set({ leadId: null }).where(eq(provisions.leadId, leadId)).run();
    db.run(sql`UPDATE inbound_emails SET lead_id = NULL WHERE lead_id = ${leadId}`);
    db.delete(leads).where(eq(leads.id, leadId)).run();

    // Prüfen ob Lead wirklich weg ist
    const check = db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId)).get();
    if (check) {
      console.error(`[DELETE /api/leads] Lead ${leadId} existiert noch nach DELETE!`);
      return NextResponse.json({ error: "Lead konnte nicht gelöscht werden" }, { status: 500 });
    }
  } catch (err) {
    console.error(`[DELETE /api/leads] Fehler beim Löschen von Lead ${leadId}:`, err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen", detail: String(err) }, { status: 500 });
  }

  const { userId, userName } = getAuditUser(session);
  logAudit({ userId, userName, action: "delete", entity: "lead", entityId: leadId, entityName: lead?.name });

  return NextResponse.json({ success: true });
}
