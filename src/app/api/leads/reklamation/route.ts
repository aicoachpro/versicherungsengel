import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";

/**
 * GET: Alle reklamierten Leads abrufen.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = db
    .select()
    .from(leads)
    .where(isNotNull(leads.reklamiertAt))
    .all();

  return NextResponse.json(result);
}

/**
 * POST: Lead reklamieren.
 * Body: { leadId: number, notiz?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, notiz } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId ist Pflichtfeld" }, { status: 400 });

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });

  const result = db
    .update(leads)
    .set({
      reklamiertAt: new Date().toISOString(),
      reklamationStatus: "offen",
      reklamationNotiz: notiz || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(leads.id, leadId))
    .returning()
    .get();

  const { userId, userName } = getAuditUser(session);
  logAudit({
    userId,
    userName,
    action: "update",
    entity: "lead",
    entityId: leadId,
    entityName: `Reklamation: ${lead.name}`,
  });

  return NextResponse.json(result);
}

/**
 * PATCH: Reklamation-Status ändern (genehmigt/abgelehnt).
 * Body: { leadId: number, status: "genehmigt" | "abgelehnt" }
 * Bei "genehmigt": terminKosten werden auf 0 gesetzt.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId, status } = await req.json();
  if (!leadId || !status) {
    return NextResponse.json({ error: "leadId und status sind Pflichtfelder" }, { status: 400 });
  }
  if (status !== "genehmigt" && status !== "abgelehnt") {
    return NextResponse.json({ error: "Status muss 'genehmigt' oder 'abgelehnt' sein" }, { status: 400 });
  }

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });

  const updateData: Record<string, unknown> = {
    reklamationStatus: status,
    updatedAt: new Date().toISOString(),
  };

  // Bei Genehmigung: Terminkosten auf 0
  if (status === "genehmigt") {
    updateData.terminKosten = 0;
  }

  const result = db
    .update(leads)
    .set(updateData)
    .where(eq(leads.id, leadId))
    .returning()
    .get();

  const { userId, userName } = getAuditUser(session);
  logAudit({
    userId,
    userName,
    action: "update",
    entity: "lead",
    entityId: leadId,
    entityName: `Reklamation ${status}: ${lead.name}`,
  });

  return NextResponse.json(result);
}
