import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { applyRuntimeMigrations } from "./runtime-migrations";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "versicherungsengel.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Drizzle-Migrationen aus drizzle/-Ordner anwenden (VOE-133).
// Idempotent ueber __drizzle_migrations-Tabelle.
// Pfad-Suche: erst CWD/drizzle (lokale Dev), dann /app/drizzle (Container).
function resolveMigrationsFolder(): string | null {
  const candidates = [
    path.join(process.cwd(), "drizzle"),
    "/app/drizzle",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "_journal.json"))) return candidate;
  }
  return null;
}

/**
 * Bootstrap fuer bestehende DBs ohne `__drizzle_migrations`-Tabelle.
 *
 * Falls die App-Tabellen (z.B. `users`) schon existieren, aber das Drizzle-
 * Tracking nicht, wuerde `migrate()` versuchen, alle bekannten Migrationen
 * erneut auszufuehren und mit `table already exists` scheitern.
 *
 * Loesung: Tabelle anlegen + alle Journal-Eintraege mit dem SHA-256-Hash
 * des SQL-Inhalts als "bereits applied" eintragen. Danach erkennt `migrate()`
 * sie als erledigt und macht nichts.
 */
function bootstrapDrizzleMigrationsIfNeeded(sqlite: Database.Database, migrationsFolder: string): void {
  const drizzleTable = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?")
    .get("table", "__drizzle_migrations");
  if (drizzleTable) return;

  const usersTable = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?")
    .get("table", "users");
  if (!usersTable) return; // frische DB → Drizzle macht alles selbst

  console.log("[db] Bootstrap: __drizzle_migrations fuer bestehende DB anlegen");
  sqlite.exec(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )
  `);

  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return;

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries?: Array<{ tag: string; when: number }>;
  };
  const insert = sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)");

  for (const entry of journal.entries || []) {
    const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) continue;
    const sql = fs.readFileSync(sqlFile, "utf8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex");
    insert.run(hash, entry.when);
    console.log(`[db] Markiert als applied: ${entry.tag} (${hash.slice(0, 8)}...)`);
  }
}

// Beim Next.js-Build wird db/index.ts vom Prerender geladen. Eine frische
// Build-DB wuerde dann scheitern, weil das Drizzle-Journal nicht vollstaendig
// ist (nur 0000-Migration drin) und applyRuntimeMigrations auf Tabellen
// zugreift, die im Build noch nicht existieren. Migration darf nur zur
// Runtime laufen, nicht beim Build.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildPhase) {
  const migrationsFolder = resolveMigrationsFolder();
  if (migrationsFolder) {
    try {
      bootstrapDrizzleMigrationsIfNeeded(sqlite, migrationsFolder);
      migrate(db, { migrationsFolder });
      console.log(`[db] Drizzle-Migrationen aus ${migrationsFolder} angewendet`);
    } catch (err) {
      console.error("[db] Drizzle-Migrationen fehlgeschlagen:", err);
      // Best-effort Telegram-Alert ueber dynamic import, damit hier kein Zirkel-Import entsteht
      import("../lib/telegram")
        .then((mod) =>
          mod.sendTelegramMessage(
            `<b>DB-Migration fehlgeschlagen</b>\n${err instanceof Error ? err.message : String(err)}`,
          ),
        )
        .catch(() => {});
      throw err;
    }
  } else {
    console.warn("[db] Kein drizzle/-Ordner gefunden — Drizzle-Migrationen werden uebersprungen");
  }

  // Custom idempotente Schema-Ensures (VOE-156, 174, 175, 191).
  // Laeuft NACH den Drizzle-Migrationen, damit Tabellen existieren.
  try {
    applyRuntimeMigrations(sqlite);
  } catch (err) {
    console.error("[db] Runtime-Migrationen fehlgeschlagen:", err);
    import("../lib/telegram")
      .then((mod) =>
        mod.sendTelegramMessage(
          `<b>Runtime-Migration fehlgeschlagen</b>\n${err instanceof Error ? err.message : String(err)}`,
        ),
      )
      .catch(() => {});
    throw err;
  }
}
