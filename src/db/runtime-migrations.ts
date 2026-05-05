import type Database from "better-sqlite3";
import { CHECK_DIREKT_SPARTEN, LEGACY_KUERZEL_MAP } from "./seeds/check-direkt-sparten";

/**
 * Idempotente Schema-Migrationen, die beim Container-Start automatisch laufen.
 * Ergaenzt das separate migrate.ts-Skript (das zusaetzlich Seed-Logik enthaelt).
 *
 * Hier landen neue Tabellen / Spalten, damit ein Deploy ohne manuelle
 * SQL-Eingriffe produktionstauglich ist. Nur CREATE IF NOT EXISTS /
 * ADD COLUMN IF NOT EXISTS - keine zerstoerenden Aenderungen.
 */
export function applyRuntimeMigrations(sqlite: Database.Database): void {
  // VOE-156: Hedy-Gespraechsnotizen
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS hedy_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      session_id TEXT NOT NULL UNIQUE,
      title TEXT,
      started_at TEXT,
      ended_at TEXT,
      participants TEXT,
      summary TEXT,
      raw TEXT,
      lead_id INTEGER,
      activity_id INTEGER,
      match_status TEXT NOT NULL DEFAULT 'pending',
      match_confidence REAL,
      match_reason TEXT,
      error_message TEXT,
      imported_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hedy_sessions_lead_id ON hedy_sessions(lead_id);
    CREATE INDEX IF NOT EXISTS idx_hedy_sessions_match_status ON hedy_sessions(match_status);
    CREATE INDEX IF NOT EXISTS idx_hedy_sessions_started_at ON hedy_sessions(started_at);
  `);

  // VOE-174: Anbieter-Pause (paused_until)
  try {
    sqlite.prepare("SELECT paused_until FROM lead_providers LIMIT 1").get();
  } catch {
    sqlite.prepare("ALTER TABLE lead_providers ADD COLUMN paused_until TEXT").run();
    console.log("Added 'paused_until' column to lead_providers table");
  }

  // VOE-175: Pause-Beginn (paused_from)
  try {
    sqlite.prepare("SELECT paused_from FROM lead_providers LIMIT 1").get();
  } catch {
    sqlite.prepare("ALTER TABLE lead_providers ADD COLUMN paused_from TEXT").run();
    console.log("Added 'paused_from' column to lead_providers table");
  }

  // VOE-191: Check-Direkt-Sparten + kuerzel-Spalte
  // Vorher in migrate.ts (manuelles Skript), jetzt automatisch beim Start.
  // Zuerst Spalte sicherstellen, dann Legacy-Kuerzel updaten, dann Sparten seeden.
  // Reihenfolge ist wichtig: ohne den Legacy-Update wuerde der Seed Duplikate
  // einfuegen, weil bestehende Sparten kein Kuerzel haben.
  try {
    sqlite.prepare("SELECT kuerzel FROM lead_products LIMIT 1").get();
  } catch {
    sqlite.prepare("ALTER TABLE lead_products ADD COLUMN kuerzel TEXT").run();
    console.log("Added 'kuerzel' column to lead_products table");
  }

  // Bestehende Sparten mit Kuerzel versehen (nur wenn noch keins gesetzt ist)
  const updateKuerzel = sqlite.prepare(
    "UPDATE lead_products SET kuerzel = ? WHERE name = ? AND (kuerzel IS NULL OR kuerzel = '')"
  );
  for (const [name, kuerzel] of Object.entries(LEGACY_KUERZEL_MAP)) {
    updateKuerzel.run(kuerzel, name);
  }

  // Check-Direkt-Sparten einfuegen, wenn das Kuerzel noch nicht existiert.
  // Idempotent: erneuter Start fuegt nichts erneut ein.
  const insertSparte = sqlite.prepare(
    `INSERT INTO lead_products (name, kuerzel, sort_order)
     SELECT ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM lead_products WHERE kuerzel = ?)`
  );
  let inserted = 0;
  let sortIdx = 100;
  for (const [kuerzel, name] of CHECK_DIREKT_SPARTEN) {
    const result = insertSparte.run(name, kuerzel, sortIdx++, kuerzel);
    if (result.changes > 0) inserted++;
  }
  if (inserted > 0) {
    console.log(`[VOE-191] Seeded ${inserted} Check-Direkt Sparten as lead_products`);
  }
}
