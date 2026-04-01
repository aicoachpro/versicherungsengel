import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities } from "@/db/schema";
import { eq, like, desc, and, isNull } from "drizzle-orm";
import { sendTelegramMessage, isAuthorizedChat } from "@/lib/telegram";

/**
 * Telegram Bot Webhook — empfängt Updates von Telegram.
 * Commands: /lead, /aktivitaet, /status, /suche
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = body.message;

  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Nur autorisierte Chats
  if (!isAuthorizedChat(chatId)) {
    await sendTelegramMessage("⛔ Nicht autorisiert.", chatId);
    return NextResponse.json({ ok: true });
  }

  // Command-Parsing
  if (text.startsWith("/lead")) {
    await handleLead(chatId, text);
  } else if (text.startsWith("/aktivitaet") || text.startsWith("/aktivität")) {
    await handleAktivitaet(chatId, text);
  } else if (text.startsWith("/status")) {
    await handleStatus(chatId);
  } else if (text.startsWith("/suche")) {
    await handleSuche(chatId, text);
  } else if (text.startsWith("/hilfe") || text.startsWith("/start") || text.startsWith("/help")) {
    await handleHilfe(chatId);
  } else {
    await sendTelegramMessage(
      "Unbekannter Befehl. Tippe /hilfe für alle Commands.",
      chatId
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * /lead [Name] — Neuen Lead anlegen
 */
async function handleLead(chatId: string, text: string) {
  const name = text.replace(/^\/(lead)\s*/i, "").trim();
  if (!name) {
    await sendTelegramMessage("Bitte Name angeben:\n<code>/lead Firma XY</code>", chatId);
    return;
  }

  const result = db
    .insert(leads)
    .values({
      name,
      phase: "Termin eingegangen",
      eingangsdatum: new Date().toISOString().split("T")[0],
      terminKosten: 320,
    })
    .returning()
    .get();

  await sendTelegramMessage(
    `✅ <b>Lead erstellt</b>\n\n` +
    `📋 ${result.name}\n` +
    `🔹 Phase: Termin eingegangen\n` +
    `🆔 ID: ${result.id}`,
    chatId
  );
}

/**
 * /aktivitaet [Lead-Name oder ID] | [Notiz]
 */
async function handleAktivitaet(chatId: string, text: string) {
  const args = text.replace(/^\/(aktivitaet|aktivität)\s*/i, "").trim();
  const pipeIndex = args.indexOf("|");

  if (!args || pipeIndex === -1) {
    await sendTelegramMessage(
      "Format:\n<code>/aktivitaet Lead-Name | Notiz</code>\n\nBeispiel:\n<code>/aktivitaet Müller GmbH | Telefon geführt, Angebot folgt</code>",
      chatId
    );
    return;
  }

  const leadQuery = args.substring(0, pipeIndex).trim();
  const notiz = args.substring(pipeIndex + 1).trim();

  // Lead suchen: per ID oder Name
  let lead;
  if (/^\d+$/.test(leadQuery)) {
    lead = db.select().from(leads).where(eq(leads.id, Number(leadQuery))).get();
  } else {
    lead = db
      .select()
      .from(leads)
      .where(like(leads.name, `%${leadQuery}%`))
      .get();
  }

  if (!lead) {
    await sendTelegramMessage(`❌ Lead "${leadQuery}" nicht gefunden.`, chatId);
    return;
  }

  const activity = db
    .insert(activities)
    .values({
      leadId: lead.id,
      datum: new Date().toISOString(),
      kontaktart: "Sonstiges",
      notiz: `[Telegram] ${notiz}`,
    })
    .returning()
    .get();

  await sendTelegramMessage(
    `✅ <b>Aktivität gespeichert</b>\n\n` +
    `📋 Lead: ${lead.name}\n` +
    `📝 ${notiz}\n` +
    `🆔 Aktivität #${activity.id}`,
    chatId
  );
}

/**
 * /status — Kurzübersicht
 */
async function handleStatus(chatId: string) {
  const allLeads = db
    .select()
    .from(leads)
    .where(isNull(leads.archivedAt))
    .all();

  const offene = allLeads.filter((l) =>
    ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt"].includes(l.phase)
  );
  const abgeschlossen = allLeads.filter((l) => l.phase === "Abgeschlossen");

  const heute = new Date().toISOString().split("T")[0];
  const heuteTermine = allLeads.filter(
    (l) => l.termin && l.termin.startsWith(heute)
  );
  const heuteFolgetermine = allLeads.filter(
    (l) => l.folgetermin && l.folgetermin.startsWith(heute)
  );

  const perPhase = offene.reduce((acc, l) => {
    acc[l.phase] = (acc[l.phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let msg = `📊 <b>Status-Übersicht</b>\n\n`;
  msg += `📂 Offene Leads: <b>${offene.length}</b>\n`;
  for (const [phase, count] of Object.entries(perPhase)) {
    msg += `  └ ${phase}: ${count}\n`;
  }
  msg += `✅ Abgeschlossen: ${abgeschlossen.length}\n`;
  msg += `📅 Termine heute: ${heuteTermine.length}\n`;
  msg += `🔔 Folgetermine heute: ${heuteFolgetermine.length}\n`;

  if (heuteTermine.length > 0) {
    msg += `\n<b>Heutige Termine:</b>\n`;
    for (const l of heuteTermine) {
      const zeit = l.termin!.includes("T")
        ? new Date(l.termin!).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
        : "";
      msg += `  • ${l.name}${zeit ? ` (${zeit})` : ""}\n`;
    }
  }

  await sendTelegramMessage(msg, chatId);
}

/**
 * /suche [Name] — Lead suchen
 */
async function handleSuche(chatId: string, text: string) {
  const query = text.replace(/^\/suche\s*/i, "").trim();
  if (!query) {
    await sendTelegramMessage("Bitte Suchbegriff angeben:\n<code>/suche Müller</code>", chatId);
    return;
  }

  const results = db
    .select()
    .from(leads)
    .where(like(leads.name, `%${query}%`))
    .orderBy(desc(leads.updatedAt))
    .limit(10)
    .all();

  if (results.length === 0) {
    await sendTelegramMessage(`🔍 Keine Leads gefunden für "${query}".`, chatId);
    return;
  }

  let msg = `🔍 <b>${results.length} Lead${results.length > 1 ? "s" : ""} gefunden:</b>\n\n`;
  for (const l of results) {
    const archived = l.archivedAt ? " 🗄️" : "";
    msg += `<b>${l.name}</b>${archived}\n`;
    msg += `  🔹 ${l.phase} · ID: ${l.id}\n`;
    if (l.ansprechpartner) msg += `  👤 ${l.ansprechpartner}\n`;
    if (l.telefon) msg += `  📞 ${l.telefon}\n`;
    msg += `\n`;
  }

  await sendTelegramMessage(msg, chatId);
}

/**
 * /hilfe — Alle Commands anzeigen
 */
async function handleHilfe(chatId: string) {
  await sendTelegramMessage(
    `🤖 <b>Versicherungsengel Bot</b>\n\n` +
    `<b>Commands:</b>\n` +
    `<code>/lead [Name]</code> — Neuen Lead anlegen\n` +
    `<code>/aktivitaet [Lead] | [Notiz]</code> — Aktivität erfassen\n` +
    `<code>/suche [Name]</code> — Lead suchen\n` +
    `<code>/status</code> — Kurzübersicht\n` +
    `<code>/hilfe</code> — Diese Hilfe anzeigen`,
    chatId
  );
}
