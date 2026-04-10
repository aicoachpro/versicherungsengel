import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { seedDemoData } from "./demo-seed";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "versicherungsengel.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

// Run migrations
migrate(db, { migrationsFolder: "./drizzle" });

// Seed default admin user if none exists
const existing = sqlite.prepare("SELECT id FROM users LIMIT 1").get();
if (!existing) {
  const hash = bcrypt.hashSync("Admin2024!", 10);
  sqlite
    .prepare(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`
    )
    .run("Thomas Völker", "thomas@voelker.finance", hash, "admin");
  console.log("Default admin user created: thomas@voelker.finance / Admin2024!");
}

// Add produkt column to insurances if not exists
try {
  sqlite.prepare("SELECT produkt FROM insurances LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE insurances ADD COLUMN produkt TEXT").run();
  console.log("Added 'produkt' column to insurances table");
}

// Add cross_selling column to leads if not exists
try {
  sqlite.prepare("SELECT cross_selling FROM leads LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE leads ADD COLUMN cross_selling TEXT").run();
  console.log("Added 'cross_selling' column to leads table");
}

// Create produkte table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS produkte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kategorie TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Seed standard Allianz cross-selling products
const existingProdukte = sqlite.prepare("SELECT id FROM produkte WHERE kategorie = 'cross_selling' LIMIT 1").get();
if (!existingProdukte) {
  const crossSellingProducts = [
    "bAV", "KFZ", "Haftpflicht", "Rechtsschutz", "Hausrat",
    "Wohngebäude", "Unfallversicherung", "Berufsunfähigkeit",
    "Risikoleben", "Privatrente", "Krankenversicherung",
    "Zahnzusatz", "Reiseversicherung", "Gewerbe-Haftpflicht",
    "Cyber-Versicherung",
  ];
  const insertProdukt = sqlite.prepare(
    "INSERT INTO produkte (name, kategorie) VALUES (?, 'cross_selling')"
  );
  for (const name of crossSellingProducts) {
    insertProdukt.run(name);
  }
  console.log(`Seeded ${crossSellingProducts.length} standard cross-selling products`);
}

// Add folgetermin_typ column to leads if not exists
try {
  sqlite.prepare("SELECT folgetermin_typ FROM leads LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE leads ADD COLUMN folgetermin_typ TEXT").run();
  console.log("Added 'folgetermin_typ' column to leads table");
}

// Add address fields to leads if not exist
for (const col of ["strasse", "plz", "ort"]) {
  try {
    sqlite.prepare(`SELECT ${col} FROM leads LIMIT 1`).get();
  } catch {
    sqlite.prepare(`ALTER TABLE leads ADD COLUMN ${col} TEXT`).run();
    console.log(`Added '${col}' column to leads table`);
  }
}

// Add superchat_contact_id column to leads if not exists
try {
  sqlite.prepare("SELECT superchat_contact_id FROM leads LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE leads ADD COLUMN superchat_contact_id TEXT").run();
  console.log("Added 'superchat_contact_id' column to leads table");
}

// Create settings table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create lead_providers table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS lead_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    lead_type TEXT NOT NULL DEFAULT '',
    min_per_month INTEGER NOT NULL DEFAULT 10,
    cost_per_lead REAL NOT NULL DEFAULT 320,
    billing_model TEXT NOT NULL DEFAULT 'prepaid',
    carry_over INTEGER NOT NULL DEFAULT 1,
    start_month TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Add provider_id column to leads if not exists
try {
  sqlite.prepare("SELECT provider_id FROM leads LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE leads ADD COLUMN provider_id INTEGER").run();
  console.log("Added 'provider_id' column to leads table");
}

// Create email_accounts table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS email_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    use_ssl INTEGER NOT NULL DEFAULT 1,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT 'INBOX',
    active INTEGER NOT NULL DEFAULT 1,
    last_polled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create inbound_emails table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS inbound_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    account_id INTEGER NOT NULL,
    message_id TEXT NOT NULL,
    from_address TEXT NOT NULL,
    from_name TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    html_body TEXT,
    received_at TEXT NOT NULL,
    processed_at TEXT,
    lead_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create lead_products table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS lead_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Seed lead products if empty
const existingLeadProducts = sqlite.prepare("SELECT id FROM lead_products LIMIT 1").get();
if (!existingLeadProducts) {
  const leadProductSeeds = [
    ["Beratung", 1], ["Betriebshaftpflicht", 2], ["Finanzierung", 3],
    ["Firmenrechtsschutzversicherung", 4], ["Firmenversicherung", 5],
    ["Flottenversicherung", 6], ["Haftpflichtversicherung", 7],
    ["Hausratversicherung", 8], ["Hundeversicherung", 9],
    ["KFZ-Versicherung", 10], ["Krankenzusatzversicherung", 11],
    ["Pferdeversicherung", 12], ["Rechtsschutzversicherung", 13],
    ["Sterbegeldversicherung", 14], ["Unfallversicherung", 15],
    ["Vermögensschadenhaftpflicht", 16], ["Wohngebäudeversicherung", 17],
    ["Zahnzusatzversicherung", 18], ["Private Krankenversicherung", 19],
    ["Private Pflegeversicherung", 20],
    ["Firmeninhaltsversicherung", 21],
    ["Cyberschutzversicherung", 22],
  ];
  const insertLeadProduct = sqlite.prepare(
    "INSERT INTO lead_products (name, sort_order) VALUES (?, ?)"
  );
  for (const [name, order] of leadProductSeeds) {
    insertLeadProduct.run(name, order);
  }
  console.log(`Seeded ${leadProductSeeds.length} lead products`);
}

// Create provider_products junction table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS provider_products (
    provider_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL
  )
`).run();

// Add assigned_to column to leads if not exists
try {
  sqlite.prepare("SELECT assigned_to FROM leads LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE leads ADD COLUMN assigned_to INTEGER").run();
  console.log("Added 'assigned_to' column to leads table");
}

// Add product_id column to leads if not exists
try {
  sqlite.prepare("SELECT product_id FROM leads LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE leads ADD COLUMN product_id INTEGER").run();
  console.log("Added 'product_id' column to leads table");
}

// Create provision_imports table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS provision_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    filename TEXT NOT NULL,
    import_date TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    total_betrag REAL NOT NULL DEFAULT 0,
    matched_rows INTEGER NOT NULL DEFAULT 0,
    unmatched_rows INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create notifications table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_id INTEGER,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create provisions table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS provisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    import_id INTEGER NOT NULL,
    buchungs_datum TEXT NOT NULL,
    vers_nehmer TEXT NOT NULL,
    bsz TEXT,
    vers_nummer TEXT,
    datev_konto TEXT,
    konto_name TEXT,
    buchungstext TEXT,
    erfolgs_datum TEXT,
    vtnr TEXT,
    prov_basis REAL NOT NULL DEFAULT 0,
    prov_satz REAL NOT NULL DEFAULT 0,
    betrag REAL NOT NULL DEFAULT 0,
    lead_id INTEGER,
    match_confidence REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Add confirmed column to provisions if not exists
try {
  sqlite.prepare("SELECT confirmed FROM provisions LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE provisions ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0").run();
  console.log("Added 'confirmed' column to provisions table");
}

// Add skipped_rows column to provision_imports if not exists
try {
  sqlite.prepare("SELECT skipped_rows FROM provision_imports LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE provision_imports ADD COLUMN skipped_rows INTEGER NOT NULL DEFAULT 0").run();
  console.log("Added 'skipped_rows' column to provision_imports table");
}

// Add kuerzel column to lead_products if not exists
try {
  sqlite.prepare("SELECT kuerzel FROM lead_products LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE lead_products ADD COLUMN kuerzel TEXT").run();
  console.log("Added 'kuerzel' column to lead_products table");
}

// Seed Check-Direkt Sparten if not already present
const existingCount = (sqlite.prepare("SELECT COUNT(*) as cnt FROM lead_products").get() as { cnt: number }).cnt;
if (existingCount < 50) {
  const checkDirektSparten: [string, string][] = [
    ["B-KV", "Betriebliche Krankenversicherung"],
    ["BRV", "Basisrentenversicherung"],
    ["TiKv-H", "Hunde Krankenversicherung"],
    ["KVB", "Krankenversicherung fuer Beamte"],
    ["Q-AVS", "vorqualifizierte Altersvorsorge"],
    ["Q-BUV", "vorqualifizierte Berufsunfaehigkeitsversicherung"],
    ["Q-KVV", "vorqualifizierte Private Krankenvollversicherung"],
    ["VSH", "Vermoegenssschadenhaftpflicht"],
    ["Q-GwS", "vorqualifizierte gewerbliche Sachversicherung"],
    ["Q-RsV", "vorqualifizierte Rechtsschutzversicherung"],
    ["Q-St-Geld", "vorqualifizierte Sterbegeldversicherung"],
    ["AVS", "Altersvorsorge"],
    ["AVS55+", "Altersvorsorge 55+"],
    ["AVS-A", "Altersvorsorge fuer Akademiker"],
    ["AVS-B", "Altersvorsorge fuer Beamte"],
    ["AVS-KAP", "Altersvorsorge mit Kapitalanlage"],
    ["AVSU35", "Altersvorsorge U35"],
    ["Arch-V", "Architektenversicherung"],
    ["Arzt-V", "Aerzteversicherung"],
    ["AUT", "Automatenversicherung"],
    ["BSV", "Bausparvertrag"],
    ["B-HV", "Berufshaftpflichtversicherung"],
    ["Arzt-BHV", "Berufshaftpflichtversicherung fuer Aerzte"],
    ["B-RS", "Berufsrechtsschutz"],
    ["BUV", "Berufsunfaehigkeitsversicherung"],
    ["BUV35+", "Berufsunfaehigkeitsversicherung 35+"],
    ["BUV55+", "Berufsunfaehigkeitsversicherung 55+"],
    ["BAV", "Betriebliche Altersvorsorge"],
    ["BAS", "Betriebsausfallversicherung"],
    ["BHV", "Betriebshaftpflichtversicherung"],
    ["BU", "Betriebsunterbrechungsversicherung"],
    ["KFZ-BMW", "BMW Versicherung"],
    ["BV", "Brillenversicherung"],
    ["BUEV", "Bueroversicherung"],
    ["CYBR", "Cyberversicherung"],
    ["CYBR-G", "Cyberversicherung gewerblich"],
    ["DUV", "Dienstunfaehigkeitsversicherung"],
    ["DaO", "Directors & Officers"],
    ["DD", "Dread Disease"],
    ["EBV", "E-Bike-Versicherung"],
    ["EAV", "Ertragsausfallversicherung"],
    ["ErwerbU", "Erwerbsunfaehigkeitsversicherung"],
    ["ETF-RV", "ETF-Rente"],
    ["ETF-Spar", "ETF-Sparplan"],
    ["FDV", "Fahrradversicherung"],
    ["F-RS", "Familienrechtsschutz"],
    ["KFZ-F", "Ferrariversicherung"],
    ["FIV", "Flottenversicherung"],
    ["FZV", "Flugzeugversicherung"],
    ["FB-V", "Freiberuflerversicherung"],
    ["Gas", "Gasvergleich"],
    ["GA", "Geldanlage"],
    ["GF-V", "Geschaeftsfuehrer Versicherung"],
    ["GIV", "Geschaeftsinhaltsversicherung"],
    ["gKV", "gesetzliche Krankenversicherung"],
    ["RsVG", "gewerbliche Rechtsschutzversicherung"],
    ["GwS", "gewerbliche Sachversicherung"],
    ["GLS", "Glasversicherung"],
    ["GUV", "Gruppenunfallversicherung"],
    ["HRV", "Hausratversicherung"],
    ["HuHa", "Hunde Haftpflichtversicherung"],
    ["Hunde-OP", "Hunde-OP-Versicherung"],
    ["Immo", "Immobilien"],
    ["IF", "Immobilienfinanzierung"],
    ["IDV", "Industrieversicherung"],
    ["Ing-V", "Ingenieurversicherung"],
    ["JHV", "Jagdhaftpflichtversicherung"],
    ["KFZ-J", "Jaguarversicherung"],
    ["KAP", "Kapitalanlageimmobilie"],
    ["K-LV", "Kapitalbildende Lebensversicherung"],
    ["KAT", "Katzenversicherung"],
    ["KFZ-TK", "KFZ Kredit"],
    ["KFZ-VK", "KFZ Vollkasko"],
    ["KFZ-O", "KFZ-Oldtimer Versicherung"],
    ["KSP", "Kindersparplan"],
    ["Kombi", "Kombi-Sachversicherung"],
    ["KFZ", "Kraftfahrzeugversicherung"],
    ["KRV", "Krebsversicherung"],
    ["KUV", "Kunstversicherung"],
    ["KFZ-L", "Lamborghiniversicherung"],
    ["KFZ-LR", "Land Rover Versicherung"],
    ["LWV", "Landwirtschaftsversicherung"],
    ["LV", "Lebensversicherung"],
    ["Leh-V", "Lehrerversicherung"],
    ["MRS", "Manager-Rechtsschutzversicherung"],
    ["MBV", "Maschinenbruchversicherung"],
    ["MV", "Maschinenversicherung"],
    ["MFHV", "Mehrfamilienhausversicherung"],
    ["KFZ-AMG", "Mercedes-AMG Versicherung"],
    ["M-RS", "Mieterrechtsschutz"],
    ["MKV", "Mietkautionsversicherung"],
    ["MPV", "Mopedversicherung"],
    ["MRV", "Motorradversicherung"],
    ["KFZ-N", "Neuwagenversicherung"],
    ["PfV", "Pferdeversicherung"],
    ["PV-V", "Photovoltaikversicherung"],
    ["KVV-EL", "PKV Elite"],
    ["PKV-Zahn", "PKV-Zahn"],
    ["KFZ-P", "Porscheversicherung"],
    ["PRA", "Praxisausfallversicherung"],
    ["PHI", "Private Health Insurance"],
    ["PHV", "private Haftpflichtversicherung"],
    ["KVV", "Private Krankenvollversicherung"],
    ["KVV-L", "Private Krankenvollversicherung (L)"],
    ["KVV-UL", "Private Krankenvollversicherung (UL)"],
    ["KV55+", "Private Krankenversicherung 55+"],
    ["KV60+", "Private Krankenversicherung 60+"],
    ["KVV-M", "Private Krankenvollversicherung Medium"],
    ["PK", "Privatkredit"],
    ["P-HV", "Produkthaftpflichtversicherung"],
    ["PK-V", "Prokuristen Versicherung"],
    ["Psy-V", "Psychotherapeutenversicherung"],
    ["RA-V", "Rechtsanwaltversicherung"],
    ["RsV", "Rechtsschutzversicherung"],
    ["RSV-R", "Rechtsschutzversicherung (R)"],
    ["RsV-L", "Rechtsschutzversicherung Light"],
    ["RKV", "Reisekrankenversicherung"],
    ["RTT", "Reiseruecktrittsversicherung"],
    ["RSE", "Reiseversicherung"],
    ["RRV", "Riesterrentenversicherung"],
    ["RLV", "Risikolebensversicherung"],
    ["RWS", "Rueckwechsler"],
    ["RueRV", "Rueruprentenversicherung"],
    ["SFV", "Schliessfachversicherung"],
    ["SV-V", "Schluesselverlustversicherung"],
    ["SRV", "Sofort Rentenversicherung"],
    ["Sold-V", "Soldatenversicherung"],
    ["Sport-UV", "Sportunfallversicherung"],
    ["St-Geld", "Sterbegeldversicherung"],
    ["St-Geld-L", "Sterbegeldversicherung Light"],
    ["StB-V", "Steuerberaterversicherung"],
    ["Strom", "Stromvergleich"],
    ["StromG", "Stromvergleich Gewerbe"],
    ["StromGas", "Stromvergleich und Gasvergleich"],
    ["KFZ-T", "Teslaversicherung"],
    ["TRV", "Transportversicherung"],
    ["Unv", "Unfallversicherung"],
    ["VAL", "Valorenversicherung"],
    ["V-HV", "Veranstaltungshaftpflichtversicherung"],
    ["V-RS", "Verkehrsrechtsschutz"],
    ["VM-V", "Vermieter Versicherung"],
    ["RsVV", "Vermieterrechtsschutzversicherung"],
    ["VVW", "Vermoegensverwaltung"],
    ["VWL", "Vermoegenswirksame Leistungen"],
    ["VRS", "Vertragsrechtsschutzversicherung"],
    ["VSV", "Vertrauensschadenversicherung"],
    ["KFZ-V", "Volvo Versicherung"],
    ["Q-BV", "vorqualifizierte Brillenversicherung"],
    ["WKV", "Warenkreditversicherung"],
    ["WGV", "Wohngebaeudeversicherung"],
    ["WMV", "Wohnmobilversicherung"],
    ["YBV", "Yacht-/Bootsversicherung"],
    ["ZA-V", "Zahnaerzteversicherung"],
    ["ZV-Zahn", "Zahnzusatzversicherung"],
    ["ZV-Zahn-L", "Zahnzusatzversicherung light"],
  ];

  const insertStmt = sqlite.prepare(
    "INSERT OR IGNORE INTO lead_products (name, kuerzel, sort_order) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM lead_products WHERE kuerzel = ?)"
  );
  let inserted = 0;
  let sortIdx = 100;
  for (const [kuerzel, name] of checkDirektSparten) {
    const changes = insertStmt.run(name, kuerzel, sortIdx++, kuerzel);
    if (changes.changes > 0) inserted++;
  }
  if (inserted > 0) {
    console.log(`Seeded ${inserted} Check-Direkt Sparten as lead_products`);
  }

  // Update existing products with kuerzel where missing
  const kuerzelMap: Record<string, string> = {
    "Betriebshaftpflicht": "BHV",
    "Beratung": "BER",
    "Finanzierung": "IF",
    "Firmenrechtsschutzversicherung": "RsVG",
    "Firmenversicherung": "GIV",
    "Flottenversicherung": "FIV",
    "Haftpflichtversicherung": "PHV",
    "Hausratversicherung": "HRV",
    "Hundeversicherung": "TiKv-H",
    "KFZ-Versicherung": "KFZ",
    "Krankenzusatzversicherung": "KVV",
    "Pferdeversicherung": "PfV",
    "Rechtsschutzversicherung": "RsV",
    "Sterbegeldversicherung": "St-Geld",
    "Unfallversicherung": "Unv",
    "Vermögensschadenhaftpflicht": "VSH",
    "Wohngebäudeversicherung": "WGV",
    "Zahnzusatzversicherung": "ZV-Zahn",
    "Private Krankenversicherung": "KVV",
    "Private Pflegeversicherung": "PPV",
    "Firmeninhaltsversicherung": "GIV",
    "Cyberschutzversicherung": "CYBR",
  };
  const updateKuerzel = sqlite.prepare("UPDATE lead_products SET kuerzel = ? WHERE name = ? AND (kuerzel IS NULL OR kuerzel = '')");
  for (const [name, kuerzel] of Object.entries(kuerzelMap)) {
    updateKuerzel.run(kuerzel, name);
  }
}

// Add cost_per_lead column to provider_products if not exists
try {
  sqlite.prepare("SELECT cost_per_lead FROM provider_products LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE provider_products ADD COLUMN cost_per_lead REAL").run();
  console.log("Added 'cost_per_lead' column to provider_products table");
}

// Add superchat_option column to provider_products if not exists
try {
  sqlite.prepare("SELECT superchat_option FROM provider_products LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE provider_products ADD COLUMN superchat_option TEXT").run();
  console.log("Added 'superchat_option' column to provider_products table");
}

// Add purchased column to provider_products if not exists
try {
  sqlite.prepare("SELECT purchased FROM provider_products LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE provider_products ADD COLUMN purchased INTEGER NOT NULL DEFAULT 0").run();
  console.log("Added 'purchased' column to provider_products table");
}

// Add provider_id column to email_accounts if not exists
try {
  sqlite.prepare("SELECT provider_id FROM email_accounts LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE email_accounts ADD COLUMN provider_id INTEGER").run();
  console.log("Added 'provider_id' column to email_accounts table");
}

// Create insurance_companies table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS insurance_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create company_products table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS company_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create product_mappings table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS product_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    company_product_id INTEGER NOT NULL,
    lead_product_id INTEGER NOT NULL,
    confidence REAL,
    manually_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Add superchat_list_id column to lead_providers if not exists
try {
  sqlite.prepare("SELECT superchat_list_id FROM lead_providers LIMIT 1").get();
} catch {
  sqlite.prepare("ALTER TABLE lead_providers ADD COLUMN superchat_list_id TEXT").run();
  console.log("Added 'superchat_list_id' column to lead_providers table");
}

// Create superchat_attributes table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS superchat_attributes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    option_values TEXT NOT NULL DEFAULT '[]',
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Create lead_assignment_rules table if not exists
sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS lead_assignment_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    provider_id INTEGER NOT NULL,
    product_id INTEGER,
    user_id INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

// Generate API key for n8n if none exists
const existingKey = sqlite.prepare("SELECT id FROM api_keys LIMIT 1").get();
if (!existingKey) {
  const apiKey = "vf_" + crypto.randomUUID().replace(/-/g, "");
  sqlite
    .prepare(`INSERT INTO api_keys (key, name) VALUES (?, ?)`)
    .run(apiKey, "n8n-webhook");
  console.log(`n8n API Key created: ${apiKey}`);
}

// Demo-Modus: Fake-Daten einfügen wenn DEMO_MODE=true und DB leer
if (process.env.DEMO_MODE === "true") {
  seedDemoData(sqlite);
}

console.log("Migration complete!");
sqlite.close();
