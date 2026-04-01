import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { getConversations, sendMessage } from "@/lib/superchat";

/**
 * Nachricht an einen Lead über Superchat senden.
 * Erfordert: Lead hat superchatContactId verknüpft.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { leadId, text } = body;

  if (!leadId || !text) {
    return NextResponse.json({ error: "leadId und text sind Pflichtfelder" }, { status: 400 });
  }

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) {
    return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });
  }

  if (!lead.superchatContactId) {
    return NextResponse.json(
      { error: "Lead ist nicht mit Superchat verknüpft. Bitte zuerst Kontakt verknüpfen." },
      { status: 400 }
    );
  }

  // Erste Konversation des Kontakts holen
  const conversations = await getConversations(lead.superchatContactId);
  const conversationList = conversations.data || conversations;
  if (!conversationList || conversationList.length === 0) {
    return NextResponse.json(
      { error: "Keine Superchat-Konversation gefunden. Der Kontakt muss zuerst eine Nachricht senden." },
      { status: 400 }
    );
  }

  const conversationId = conversationList[0].id;

  // Nachricht senden
  const result = await sendMessage(conversationId, text);

  // Aktivität anlegen
  const activity = db
    .insert(activities)
    .values({
      leadId,
      datum: new Date().toISOString(),
      kontaktart: "WhatsApp",
      notiz: `[Gesendet via Superchat] ${text}`,
    })
    .returning()
    .get();

  const { userId, userName } = getAuditUser(session);
  logAudit({
    userId,
    userName,
    action: "create",
    entity: "activity",
    entityId: activity.id,
    entityName: "Superchat Nachricht gesendet",
  });

  return NextResponse.json({ success: true, messageId: result.id, activityId: activity.id });
}
