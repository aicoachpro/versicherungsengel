import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

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

// Generate API key for n8n if none exists
const existingKey = sqlite.prepare("SELECT id FROM api_keys LIMIT 1").get();
if (!existingKey) {
  const apiKey = "vf_" + crypto.randomUUID().replace(/-/g, "");
  sqlite
    .prepare(`INSERT INTO api_keys (key, name) VALUES (?, ?)`)
    .run(apiKey, "n8n-webhook");
  console.log(`n8n API Key created: ${apiKey}`);
}

console.log("Migration complete!");
sqlite.close();
