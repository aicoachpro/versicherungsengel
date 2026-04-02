import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

// .env fallbacks — used when DB has no value
const ENV_FALLBACKS: Record<string, () => string> = {
  "company.name": () => process.env.COMPANY_NAME || "Sales Hub",
  "company.subtitle": () => process.env.COMPANY_SUBTITLE || "",
  "company.color": () => process.env.COMPANY_COLOR || "#003781",
  "obsidian.vaultPath": () => "",
  "obsidian.reportFolder": () => "",
  "pushover.userKey": () => process.env.PUSHOVER_USER_KEY || "",
  "pushover.apiToken": () => process.env.PUSHOVER_API_TOKEN || "",
  "telegram.botToken": () => process.env.TELEGRAM_BOT_TOKEN || "",
  "telegram.chatId": () => process.env.TELEGRAM_CHAT_ID || "",
  "email.resendApiKey": () => process.env.RESEND_API_KEY || "",
  "email.fromAddress": () => process.env.RESEND_FROM || "",
  "superchat.apiKey": () => process.env.SUPERCHAT_API_KEY || "",
};

// Keys that contain secrets — masked on GET
const SECRET_KEYS = new Set([
  "pushover.userKey",
  "pushover.apiToken",
  "telegram.botToken",
  "email.resendApiKey",
  "superchat.apiKey",
]);

export function getSetting(key: string): string {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (row && row.value !== "") return row.value;
  return ENV_FALLBACKS[key]?.() ?? "";
}

export function getSettings(prefix: string): Record<string, string> {
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = {};

  // All known keys with this prefix
  for (const key of Object.keys(ENV_FALLBACKS)) {
    if (key.startsWith(prefix + ".")) {
      result[key] = getSetting(key);
    }
  }

  // Also include any DB rows with this prefix not in fallbacks
  for (const row of rows) {
    if (row.key.startsWith(prefix + ".")) {
      result[row.key] = row.value || result[row.key] || "";
    }
  }

  return result;
}

export function getAllSettings(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(ENV_FALLBACKS)) {
    result[key] = getSetting(key);
  }
  return result;
}

export function getAllSettingsMasked(): Record<string, string> {
  const all = getAllSettings();
  for (const key of SECRET_KEYS) {
    if (all[key]) {
      all[key] = maskValue(all[key]);
    }
  }
  return all;
}

export function setSetting(key: string, value: string): void {
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(settings.key, key))
      .run();
  } else {
    db.insert(settings)
      .values({ key, value, updatedAt: new Date().toISOString() })
      .run();
  }
}

export function setSettings(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    setSetting(key, value);
  }
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key);
}

function maskValue(val: string): string {
  if (val.length <= 6) return "***";
  return val.slice(0, 3) + "..." + val.slice(-3);
}
