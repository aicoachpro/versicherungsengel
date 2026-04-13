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
        // Robustere Timeouts — IMAP-Server antworten gelegentlich verzoegert
        socketTimeout: 60_000,
      });

      await client.connect();

      const folder = account.folder || "INBOX";
      const lock = await client.getMailboxLock(folder);

      try {
        // Erster Durchlauf: Ab jetzt tracken (kein Backfill alter Mails)
        const isFirstPoll = !account.lastPolledAt;
        if (isFirstPoll && !forceMode) {
          lock.release();
          db.update(emailAccounts)
            .set({ lastPolledAt: new Date().toISOString() })
            .where(eq(emailAccounts.id, account.id))
            .run();
          await client.logout();
          totalPolled++;
          continue;
        }

        // Sucht Mails per Datum — UNABHAENGIG vom Seen-Flag.
        // So werden auch Mails gefunden, die ein anderer Client bereits gelesen hat.
        // Dedup per messageId verhindert Duplikate.
        // Overlap von 5 Minuten, damit nichts zwischen zwei Polls durchrutscht.
        const lookbackDays = forceMode ? days : 0;
        const baseTime = account.lastPolledAt
          ? new Date(account.lastPolledAt).getTime() - 5 * 60 * 1000
          : Date.now() - 24 * 60 * 60 * 1000;
        const sinceDate = forceMode
          ? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
          : new Date(baseTime);
        const searchCriteria: Record<string, unknown> = { since: sinceDate };

        // Phase 1: Nur Metadaten (envelope) holen — schnell, unabhaengig von Body-Groesse
        const metadataMessages = client.fetch(searchCriteria, {
          uid: true,
          envelope: true,
        });

        const candidates: Array<{
          uid: number;
          messageId: string;
          fromAddress: string;
          fromName: string | null;
          subject: string;
          receivedAt: string;
        }> = [];

        for await (const msg of metadataMessages) {
          const messageId = msg.envelope?.messageId || `${account.id}-${msg.uid}`;

          // Dedup: bereits vorhandene Mails ueberspringen — bevor wir die Source holen
          const existing = db
            .select({ id: inboundEmails.id })
            .from(inboundEmails)
            .where(eq(inboundEmails.messageId, messageId))
            .get();
          if (existing) continue;

          candidates.push({
            uid: msg.uid,
            messageId,
            fromAddress: msg.envelope?.from?.[0]?.address || "unbekannt",
            fromName: msg.envelope?.from?.[0]?.name || null,
            subject: msg.envelope?.subject || "(kein Betreff)",
            receivedAt: msg.envelope?.date?.toISOString() || new Date().toISOString(),
          });
        }

        // Phase 2: Nur fuer wirklich neue Mails die Source holen + speichern
        for (const cand of candidates) {
          let source = "";
          try {
            const fullMsg = await client.fetchOne(
              String(cand.uid),
              { source: true },
              { uid: true },
            );
            if (fullMsg && typeof fullMsg === "object" && "source" in fullMsg && fullMsg.source) {
              source = (fullMsg.source as Buffer | string).toString();
            }
          } catch (fetchErr) {
            console.log(
              `[mail-poll] Source-Fetch fehlgeschlagen fuer UID ${cand.uid}:`,
              fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
            );
            continue;
          }

          // Kalender-Einladungen ueberspringen
          const isCalendarInvite =
            /Content-Type:\s*text\/calendar/i.test(source) ||
            /Content-Type:\s*application\/ics/i.test(source) ||
            /^(Invitation|Einladung|Updated Invitation|Canceled):/i.test(cand.subject) ||
            /\.ics["']?\s*$/im.test(source);

          if (isCalendarInvite) {
            console.log(
              `[mail-poll] Kalender-Einladung übersprungen: "${cand.subject}" von ${cand.fromAddress}`,
            );
            try {
              await client.messageFlagsAdd({ uid: cand.uid }, ["\\Seen"], { uid: true });
            } catch {
              /* nicht kritisch */
            }
            continue;
          }

          console.log(
            `[mail-poll] Neue Mail importiert: "${cand.subject}" von ${cand.fromAddress}`,
          );

          // Body aus Source extrahieren
          let body = "";
          let htmlBody: string | null = null;
          if (source) {
            const { extractTextFromSource } = await import("./mail-utils");
            const extracted = extractTextFromSource(source);
            body = extracted.text || "(kein Inhalt)";
            htmlBody = extracted.html || null;
          }

          db.insert(inboundEmails)
            .values({
              accountId: account.id,
              messageId: cand.messageId,
              fromAddress: cand.fromAddress,
              fromName: cand.fromName,
              subject: cand.subject,
              body: body || "(kein Inhalt)",
              htmlBody,
              receivedAt: cand.receivedAt,
              status: "pending",
            })
            .run();

          try {
            await client.messageFlagsAdd({ uid: cand.uid }, ["\\Seen"], { uid: true });
          } catch {
            /* nicht kritisch */
          }

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
