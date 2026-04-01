const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Nachricht an den autorisierten Chat senden.
 */
export async function sendTelegramMessage(
  text: string,
  chatId: string = TELEGRAM_CHAT_ID,
  parseMode: "HTML" | "Markdown" = "HTML"
) {
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
  return res.json();
}

/**
 * Prüft ob eine Chat-ID autorisiert ist.
 */
export function isAuthorizedChat(chatId: number | string): boolean {
  const allowed = TELEGRAM_CHAT_ID.split(",").map((id) => id.trim());
  return allowed.includes(String(chatId));
}

/**
 * Webhook bei Telegram registrieren.
 */
export async function setWebhook(url: string) {
  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
}
