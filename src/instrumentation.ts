export async function register() {
  // Only run on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Database = (await import("better-sqlite3")).default;
    const path = await import("path");
    const fs = await import("fs");
    const bcrypt = (await import("bcryptjs")).default;

    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, "versicherungsengel.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    // Create tables if not exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' NOT NULL,
        totp_secret TEXT,
        totp_enabled INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        phase TEXT DEFAULT 'Termin eingegangen' NOT NULL,
        termin TEXT,
        ansprechpartner TEXT,
        email TEXT,
        telefon TEXT,
        website TEXT,
        branche TEXT,
        unternehmensgroesse TEXT,
        umsatzklasse TEXT,
        gewerbeart TEXT,
        termin_kosten REAL DEFAULT 320,
        umsatz REAL,
        conversion INTEGER,
        naechster_schritt TEXT,
        notizen TEXT,
        eingangsdatum TEXT,
        cross_selling TEXT,
        folgetermin TEXT,
        folgetermin_notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS insurances (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        bezeichnung TEXT NOT NULL,
        lead_id INTEGER REFERENCES leads(id),
        sparte TEXT,
        versicherer TEXT,
        produkt TEXT,
        beitrag REAL,
        zahlweise TEXT,
        ablauf TEXT,
        umfang TEXT,
        notizen TEXT,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS produkte (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        kategorie TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_unique ON api_keys (key);
    `);

    // Add folgetermin columns if missing (migration for existing DBs)
    const cols = sqlite.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    if (!colNames.includes("folgetermin")) {
      sqlite.exec("ALTER TABLE leads ADD COLUMN folgetermin TEXT");
    }
    if (!colNames.includes("folgetermin_notified")) {
      sqlite.exec("ALTER TABLE leads ADD COLUMN folgetermin_notified INTEGER DEFAULT 0");
    }

    // Seed default admin user if none exists
    const existing = sqlite.prepare("SELECT id FROM users LIMIT 1").get();
    if (!existing) {
      const hash = bcrypt.hashSync("Admin2024!", 10);
      sqlite
        .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
        .run("Thomas Völker", "thomas@voelker.finance", hash, "admin");
      console.log("Default admin user created: thomas@voelker.finance");
    }

    // Seed standard cross-selling products
    const existingProdukte = sqlite.prepare("SELECT id FROM produkte WHERE kategorie = 'cross_selling' LIMIT 1").get();
    if (!existingProdukte) {
      const products = [
        "bAV", "KFZ", "Haftpflicht", "Rechtsschutz", "Hausrat",
        "Wohngebäude", "Unfallversicherung", "Berufsunfähigkeit",
        "Risikoleben", "Privatrente", "Krankenversicherung",
        "Zahnzusatz", "Reiseversicherung", "Gewerbe-Haftpflicht",
        "Cyber-Versicherung",
      ];
      const insert = sqlite.prepare("INSERT INTO produkte (name, kategorie) VALUES (?, 'cross_selling')");
      for (const name of products) {
        insert.run(name);
      }
      console.log(`Seeded ${products.length} cross-selling products`);
    }

    // Generate API key for n8n if none exists
    const existingKey = sqlite.prepare("SELECT id FROM api_keys LIMIT 1").get();
    if (!existingKey) {
      const apiKey = "vf_" + crypto.randomUUID().replace(/-/g, "");
      sqlite.prepare("INSERT INTO api_keys (key, name) VALUES (?, ?)").run(apiKey, "n8n-webhook");
      console.log(`n8n API Key created: ${apiKey}`);
    }

    console.log("Database initialized successfully");
    sqlite.close();
  }
}
