import * as schema from "./schema";
import path from "path";

type DbInstance = ReturnType<typeof import("drizzle-orm/better-sqlite3").drizzle<typeof schema>>;

let _db: DbInstance | null = null;

function initDb(): DbInstance {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/better-sqlite3");

    const dbPath = path.join(process.cwd(), "data", "versicherungsengel.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema }) as DbInstance;
  }
  return _db;
}

// Proxy so that `import { db } from "@/db"` works without changes to consumers
// The actual native module is only loaded when a property is first accessed at runtime
export const db = new Proxy({} as DbInstance, {
  get(_target, prop) {
    return (initDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
