import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phase: text("phase", {
    enum: ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt", "Abgeschlossen", "Verloren"],
  }).notNull().default("Termin eingegangen"),
  termin: text("termin"),
  ansprechpartner: text("ansprechpartner"),
  email: text("email"),
  telefon: text("telefon"),
  website: text("website"),
  branche: text("branche", {
    enum: ["Bau", "Handwerk", "Dienstleistung", "Produktion", "IT", "Gesundheit", "Logistik", "Handel", "Gastronomie", "Immobilien", "Sonstiges"],
  }),
  unternehmensgroesse: text("unternehmensgroesse", {
    enum: ["1–9", "10–49", "50–199", "200–999", "1000+"],
  }),
  umsatzklasse: text("umsatzklasse", {
    enum: ["<1 Mio", "1–5 Mio", "5–20 Mio", "20–100 Mio", ">100 Mio"],
  }),
  gewerbeart: text("gewerbeart", {
    enum: ["hauptberuflich", "nebenberuflich"],
  }),
  terminKosten: real("termin_kosten").default(320),
  umsatz: real("umsatz"),
  conversion: integer("conversion"),
  naechsterSchritt: text("naechster_schritt"),
  notizen: text("notizen"),
  eingangsdatum: text("eingangsdatum"),
  crossSelling: text("cross_selling"),
  folgetermin: text("folgetermin"),
  folgeterminNotified: integer("folgetermin_notified").default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const insurances = sqliteTable("insurances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bezeichnung: text("bezeichnung").notNull(),
  leadId: integer("lead_id").references(() => leads.id),
  sparte: text("sparte", {
    enum: ["Haftpflicht", "Inhalt", "Cyber", "D&O", "Flotte", "Rechtsschutz", "bAV", "KV", "Sonstiges"],
  }),
  versicherer: text("versicherer"),
  produkt: text("produkt"),
  beitrag: real("beitrag"),
  zahlweise: text("zahlweise", {
    enum: ["monatlich", "vierteljährlich", "halbjährlich", "jährlich"],
  }),
  ablauf: text("ablauf"),
  umfang: text("umfang"),
  notizen: text("notizen"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const produkte = sqliteTable("produkte", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kategorie: text("kategorie", {
    enum: ["fremdvertrag", "cross_selling"],
  }).notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
