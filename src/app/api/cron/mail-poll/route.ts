import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailAccounts, inboundEmails } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";
import { verifyCronAuth } from "@/lib/cron-auth";
import { decrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optionale Parameter: force=1 sucht nach Datum statt nach 'unseen'
  // days=N legt das Zeitfenster fest (Default 2 Tage)
  const url = new URL(req.url);
  const forceMode = url.searchParams.get("force") === "1";
  const days = Math.max(1, Math.min(30, parseInt(url.searchParams.get("days") || "2", 10)));

  // Aktive E-Mail-Konten laden
  const accounts = db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.active, true))
    .all();

  if (accounts.length === 0) {
    return NextResponse.json({ polled: 0, newEmails: 0, message: "Keine aktiven E-Mail-Konten" });
  }

  let totalPolled = 0;
  let totalNew = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      // ImapFlow dynamisch importieren (wird vom anderen Agent installiert)
      const { ImapFlow } = await import("imapflow");

      const client = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort || 993,
        secure: !!account.useSsl,
        auth: {
          user: account.username,
          pass: decrypt(account.password),
        },
        logger: false,
      });

      await client.connect();

      const folder = account.folder || "INBOX";
      const lock = await client.getMailboxLock(folder);

      try {
        // Erster Durchlauf: nur als gelesen markieren, nicht importieren
        // Im force-Modus auslassen — wir wollen tatsaechlich holen
        const isFirstPoll = !account.lastPolledAt;
        if (isFirstPoll && !forceMode) {
          // Alle bestehenden ungelesenen Mails als gelesen markieren
          try {
            await client.messageFlagsAdd("1:*", ["\\Seen"]);
          } catch {
            // Keine Nachrichten vorhanden — OK
          }
          lock.release();
          db.update(emailAccounts)
            .set({ lastPolledAt: new Date().toISOString() })
            .where(eq(emailAccounts.id, account.id))
            .run();
          await client.logout();
          totalPolled++;
          continue;
        }

        // Standard: nur Ungelesene. Force-Mode: alle seit N Tagen (unabhaengig vom Seen-Flag)
        const searchCriteria: Record<string, unknown> = forceMode
          ? { since: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
          : { seen: false };
        const messages = client.fetch(searchCriteria, {
          uid: true,
          envelope: true,
          source: true,
          bodyStructure: true,
        });

        for await (const msg of messages) {
          const messageId = msg.envelope?.messageId || `${account.id}-${msg.uid}`;

          // Dedup: pruefen ob messageId bereits existiert
          const existing = db
            .select({ id: inboundEmails.id })
            .from(inboundEmails)
            .where(eq(inboundEmails.messageId, messageId))
            .get();

          if (existing) continue;

          // E-Mail-Inhalte extrahieren
          const fromAddress = msg.envelope?.from?.[0]?.address || "unbekannt";
          const fromName = msg.envelope?.from?.[0]?.name || null;
          const subject = msg.envelope?.subject || "(kein Betreff)";
          const receivedAt = msg.envelope?.date?.toISOString() || new Date().toISOString();

          // Kalender-Einladungen überspringen (kein Lead-Content)
          const source = msg.source?.toString() || "";
          const isCalendarInvite =
            /Content-Type:\s*text\/calendar/i.test(source) ||
            /Content-Type:\s*application\/ics/i.test(source) ||
            /^(Invitation|Einladung|Updated Invitation|Canceled):/i.test(subject) ||
            /\.ics["']?\s*$/im.test(source);

          if (isCalendarInvite) {
            console.log(`[mail-poll] Kalender-Einladung übersprungen: "${subject}" von ${fromAddress}`);
            await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
            continue;
          }

          console.log(`[mail-poll] Neue Mail importiert: "${subject}" von ${fromAddress}`);

          // Body aus Source extrahieren
          let body = "";
          let htmlBody: string | null = null;
          if (source) {
            const { extractTextFromSource } = await import("./mail-utils");
            const extracted = extractTextFromSource(source);
            body = extracted.text || "(kein Inhalt)";
            htmlBody = extracted.html || null;
          }

          // In DB speichern
          db.insert(inboundEmails)
            .values({
              accountId: account.id,
              messageId,
              fromAddress,
              fromName,
              subject,
              body: body || "(kein Inhalt)",
              htmlBody,
              receivedAt,
              status: "pending",
            })
            .run();

          // Als gelesen markieren
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });

          totalNew++;
        }

        totalPolled++;
      } finally {
        lock.release();
      }

      // lastPolledAt aktualisieren
      db.update(emailAccounts)
        .set({ lastPolledAt: new Date().toISOString() })
        .where(eq(emailAccounts.id, account.id))
        .run();

      await client.logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${account.name}: ${message}`);
      console.error(`[mail-poll] Fehler bei Konto "${account.name}":`, message);

      // Telegram Alert bei Verbindungsfehler
      try {
        await sendTelegramMessage(
          `<b>Mail-Poller Fehler</b>\nKonto: ${account.name}\nFehler: ${message}`
        );
      } catch {
        // Telegram nicht konfiguriert — ignorieren
      }
    }
  }

  return NextResponse.json({
    polled: totalPolled,
    newEmails: totalNew,
    errors: errors.length > 0 ? errors : undefined,
  });
}
