import type Database from "better-sqlite3";

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
}
