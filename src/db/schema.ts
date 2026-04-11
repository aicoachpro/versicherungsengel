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
  strasse: text("strasse"),
  plz: text("plz"),
  ort: text("ort"),
  superchatContactId: text("superchat_contact_id"),
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
  leadTyp: text("lead_typ", {
    enum: ["Gewerbe", "Privat"],
  }),
  terminKosten: real("termin_kosten").default(320),
  umsatz: real("umsatz"),
  conversion: integer("conversion"),
  naechsterSchritt: text("naechster_schritt"),
  notizen: text("notizen"),
  eingangsdatum: text("eingangsdatum"),
  crossSelling: text("cross_selling"),
  folgetermin: text("folgetermin"),
  folgeterminTyp: text("folgetermin_typ", {
    enum: ["Nachfassen", "Cross-Selling", "Beratung", "Angebot nachfassen", "Sonstiges"],
  }),
  folgeterminNotified: integer("folgetermin_notified").default(0),
  reklamiertAt: text("reklamiert_at"),
  reklamationStatus: text("reklamation_status", {
    enum: ["offen", "genehmigt", "abgelehnt"],
  }),
  reklamationNotiz: text("reklamation_notiz"),
  providerId: integer("provider_id"),
  assignedTo: integer("assigned_to"),
  productId: integer("product_id"),
  archivedAt: text("archived_at"),
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

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  datum: text("datum").notNull(),
  kontaktart: text("kontaktart", {
    enum: ["Telefon", "E-Mail", "WhatsApp", "Vor-Ort", "LinkedIn", "System", "Sonstiges"],
  }).notNull(),
  notiz: text("notiz"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  name: text("name").notNull(),
  dateipfad: text("dateipfad").notNull(),
  typ: text("typ", {
    enum: ["Angebot", "Police", "Beratungsprotokoll", "Gesprächsleitfaden", "E-Mail", "Sonstiges"],
  }).notNull().default("Sonstiges"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", {
    enum: ["new_lead", "folgetermin", "phase_change", "reklamation", "system"],
  }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityId: integer("entity_id"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const leadProviders = sqliteTable("lead_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  leadType: text("lead_type").notNull().default(""),
  minPerMonth: integer("min_per_month").notNull().default(10),
  costPerLead: real("cost_per_lead").notNull().default(320),
  billingModel: text("billing_model").notNull().default("prepaid"),
  carryOver: integer("carry_over", { mode: "boolean" }).notNull().default(true),
  startMonth: text("start_month").notNull().default(""),
  superchatListId: text("superchat_list_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const emailAccounts = sqliteTable("email_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull().default(993),
  useSsl: integer("use_ssl", { mode: "boolean" }).notNull().default(true),
  username: text("username").notNull(),
  password: text("password").notNull(),
  folder: text("folder").notNull().default("INBOX"),
  providerId: integer("provider_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastPolledAt: text("last_polled_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const inboundEmails = sqliteTable("inbound_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull(),
  messageId: text("message_id").notNull(),
  fromAddress: text("from_address").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  htmlBody: text("html_body"),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
  leadId: integer("lead_id"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const leadProducts = sqliteTable("lead_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kuerzel: text("kuerzel"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const providerProducts = sqliteTable("provider_products", {
  providerId: integer("provider_id").notNull(),
  productId: integer("product_id").notNull(),
  costPerLead: real("cost_per_lead"),
  purchased: integer("purchased", { mode: "boolean" }).notNull().default(false),
  superchatOption: text("superchat_option"),
});

export const provisionImports = sqliteTable("provision_imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  importDate: text("import_date").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  totalBetrag: real("total_betrag").notNull().default(0),
  matchedRows: integer("matched_rows").notNull().default(0),
  unmatchedRows: integer("unmatched_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const provisions = sqliteTable("provisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importId: integer("import_id").notNull(),
  buchungsDatum: text("buchungs_datum").notNull(),
  versNehmer: text("vers_nehmer").notNull(),
  bsz: text("bsz"),
  versNummer: text("vers_nummer"),
  datevKonto: text("datev_konto"),
  kontoName: text("konto_name"),
  buchungstext: text("buchungstext"),
  erfolgsDatum: text("erfolgs_datum"),
  vtnr: text("vtnr"),
  provBasis: real("prov_basis").notNull().default(0),
  provSatz: real("prov_satz").notNull().default(0),
  betrag: real("betrag").notNull().default(0),
  leadId: integer("lead_id"),
  matchConfidence: real("match_confidence"),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const insuranceCompanies = sqliteTable("insurance_companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const companyProducts = sqliteTable("company_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const productMappings = sqliteTable("product_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyProductId: integer("company_product_id").notNull(),
  leadProductId: integer("lead_product_id").notNull(),
  confidence: real("confidence"),
  manuallyVerified: integer("manually_verified", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const leadAssignmentRules = sqliteTable("lead_assignment_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id").notNull(),
  productId: integer("product_id"),
  userId: integer("user_id").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const superchatAttributes = sqliteTable("superchat_attributes", {
  id: text("id").primaryKey(), // Superchat custom attribute ID (ca_xxx)
  name: text("name").notNull(),
  type: text("type").notNull(),
  optionValues: text("option_values").notNull().default("[]"), // JSON Array
  syncedAt: text("synced_at").notNull().default(sql`(datetime('now'))`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  userName: text("user_name"),
  action: text("action", {
    enum: ["create", "update", "delete", "archive", "restore"],
  }).notNull(),
  entity: text("entity", {
    enum: ["lead", "insurance", "activity", "document", "user"],
  }).notNull(),
  entityId: integer("entity_id").notNull(),
  entityName: text("entity_name"),
  changes: text("changes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
