import { db } from "@/db";
import { hedySessions, activities, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HedyClient, HedyApiError } from "./client";
import { summarizeBundle } from "./summarize";
import { matchSessionToLead } from "./matcher";
import { getSetting, setSetting } from "@/lib/settings";
import type { HedyRegion, HedySession } from "./types";

export interface ImportOneResult {
  sessionId: string;
  status: "matched" | "unmatched" | "skipped" | "error";
  leadId?: number;
  activityId?: number;
  confidence?: number;
  reason?: string;
  error?: string;
}

export interface ImportRunResult {
  checked: number;
  imported: number;
  matched: number;
  unmatched: number;
  skipped: number;
  errors: number;
  results: ImportOneResult[];
}

function getClient(): HedyClient {
  const apiKey = getSetting("hedy.apiKey");
  if (!apiKey) throw new HedyApiError("Hedy API-Key nicht konfiguriert (Settings -> Hedy)");
  const region = (getSetting("hedy.region") || "eu") as HedyRegion;
  return new HedyClient({ apiKey, region });
}

/**
 * Importiert eine einzelne Session: lesen, matchen, persistieren.
 * Idempotent: Session-ID ist unique. Bestehende Sessions werden geskippt (ausser force=true).
 */
export async function importSingleSession(
  sessionId: string,
  opts: { force?: boolean; explicitLeadId?: number } = {},
): Promise<ImportOneResult> {
  const existing = db.select().from(hedySessions).where(eq(hedySessions.sessionId, sessionId)).get();
  if (existing && !opts.force && !opts.explicitLeadId) {
    return { sessionId, status: "skipped", reason: "Bereits importiert" };
  }

  const client = getClient();
  let bundle;
  try {
    bundle = await client.getBundle(sessionId);
  } catch (err) {
    const message = err instanceof HedyApiError ? err.message : (err as Error).message;
    upsertSessionRow(sessionId, null, null, null, "error", null, message);
    return { sessionId, status: "error", error: message };
  }

  return persistBundle(bundle.session, bundle, opts);
}

/**
 * Runter-Modus: ueber N Sessions iterieren, jede importieren.
 */
export async function runImport(opts: { limit?: number } = {}): Promise<ImportRunResult> {
  const result: ImportRunResult = {
    checked: 0,
    imported: 0,
    matched: 0,
    unmatched: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  let sessions: HedySession[];
  try {
    const client = getClient();
    sessions = await client.listSessions({ limit: opts.limit ?? 50 });
  } catch (err) {
    const message = err instanceof HedyApiError ? err.message : (err as Error).message;
    setSetting("hedy.lastImportAt", new Date().toISOString());
    setSetting("hedy.lastImportStatus", "error");
    setSetting("hedy.lastImportMessage", message);
    throw err;
  }

  result.checked = sessions.length;

  for (const session of sessions) {
    if (!session.id) {
      result.skipped++;
      continue;
    }
    // Sessions ohne Startzeit ueberspringen (kann nicht gematched werden)
    if (!session.startedAt) {
      result.skipped++;
      result.results.push({ sessionId: session.id, status: "skipped", reason: "Session ohne Startzeit" });
      continue;
    }

    const existing = db.select().from(hedySessions).where(eq(hedySessions.sessionId, session.id)).get();
    if (existing) {
      result.skipped++;
      result.results.push({ sessionId: session.id, status: "skipped", reason: "Bereits importiert" });
      continue;
    }

    try {
      const client = getClient();
      const bundle = await client.getBundle(session.id);
      const one = persistBundle(bundle.session, bundle);
      result.results.push(one);
      if (one.status === "matched") result.matched++;
      else if (one.status === "unmatched") result.unmatched++;
      else if (one.status === "error") result.errors++;
      else if (one.status === "skipped") result.skipped++;
      else result.imported++;
    } catch (err) {
      const message = err instanceof HedyApiError ? err.message : (err as Error).message;
      upsertSessionRow(session.id, null, null, null, "error", null, message);
      result.errors++;
      result.results.push({ sessionId: session.id, status: "error", error: message });
    }
  }

  const ok = result.errors === 0;
  setSetting("hedy.lastImportAt", new Date().toISOString());
  setSetting("hedy.lastImportStatus", ok ? "success" : "partial");
  setSetting(
    "hedy.lastImportMessage",
    `${result.matched} gematched · ${result.unmatched} unmatched · ${result.skipped} uebersprungen · ${result.errors} Fehler`,
  );

  return result;
}

function persistBundle(
  session: HedySession,
  bundle: { session: HedySession; highlights: import("./types").HedyHighlight[]; todos: import("./types").HedyTodo[] },
  opts: { force?: boolean; explicitLeadId?: number } = {},
): ImportOneResult {
  const summary = summarizeBundle(bundle);

  let leadId: number | null = opts.explicitLeadId ?? null;
  let confidence: number | null = null;
  let reason = "manuell zugewiesen";

  if (!leadId) {
    const windowMinutes = Number(getSetting("hedy.matchWindowMinutes") || "240") || 240;
    const match = matchSessionToLead(session, { windowMinutes });
    leadId = match.leadId;
    confidence = match.confidence;
    reason = match.reason;
  }

  const status: "matched" | "unmatched" = leadId ? "matched" : "unmatched";
  let activityId: number | null = null;

  if (leadId) {
    activityId = createOrUpdateActivity(leadId, session, summary);
    // Lead.notizen NICHT ueberschreiben — die Notiz lebt in der Activity.
  }

  upsertSessionRow(session.id, session, summary, leadId, status, confidence, reason, activityId);

  return { sessionId: session.id, status, leadId: leadId ?? undefined, activityId: activityId ?? undefined, confidence: confidence ?? undefined, reason };
}

function createOrUpdateActivity(leadId: number, session: HedySession, summary: string): number {
  // Sicherstellen dass der Lead existiert
  const lead = db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) {
    throw new Error(`Lead ${leadId} existiert nicht`);
  }

  const datum = (session.startedAt || session.endedAt || new Date().toISOString()).slice(0, 10);
  const inserted = db
    .insert(activities)
    .values({
      leadId,
      datum,
      kontaktart: "Onlinetermin",
      notiz: summary,
    })
    .returning({ id: activities.id })
    .get();

  return inserted!.id;
}

function upsertSessionRow(
  sessionId: string,
  session: HedySession | null,
  summary: string | null,
  leadId: number | null,
  matchStatus: "pending" | "matched" | "unmatched" | "manual" | "ignored" | "error",
  confidence: number | null,
  reason: string | null,
  activityId: number | null = null,
): void {
  const now = new Date().toISOString();
  const existing = db.select().from(hedySessions).where(eq(hedySessions.sessionId, sessionId)).get();

  const values = {
    sessionId,
    title: session?.title ?? null,
    startedAt: session?.startedAt ?? null,
    endedAt: session?.endedAt ?? null,
    participants: session?.participants ? JSON.stringify(session.participants) : null,
    summary,
    raw: session ? JSON.stringify(session).slice(0, 100_000) : null,
    leadId,
    activityId,
    matchStatus,
    matchConfidence: confidence,
    matchReason: reason,
    errorMessage: matchStatus === "error" ? reason : null,
    importedAt: now,
  };

  if (existing) {
    db.update(hedySessions).set(values).where(eq(hedySessions.sessionId, sessionId)).run();
  } else {
    db.insert(hedySessions).values(values).run();
  }
}

/**
 * Manuelles Zuweisen einer bereits importierten Session an einen Lead.
 */
export function assignSessionToLead(sessionId: string, leadId: number): ImportOneResult {
  const row = db.select().from(hedySessions).where(eq(hedySessions.sessionId, sessionId)).get();
  if (!row) return { sessionId, status: "error", error: "Session nicht gefunden" };

  const lead = db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return { sessionId, status: "error", error: `Lead ${leadId} existiert nicht` };

  // Falls schon eine Activity fuer diese Session existiert, nicht doppelt anlegen
  let activityId = row.activityId;
  if (!activityId && row.summary) {
    const datum = (row.startedAt || row.endedAt || new Date().toISOString()).slice(0, 10);
    const inserted = db
      .insert(activities)
      .values({ leadId, datum, kontaktart: "Onlinetermin", notiz: row.summary })
      .returning({ id: activities.id })
      .get();
    activityId = inserted!.id;
  }

  db.update(hedySessions)
    .set({
      leadId,
      activityId,
      matchStatus: "manual",
      matchReason: "Manuelle Zuordnung",
      matchConfidence: 1,
    })
    .where(eq(hedySessions.sessionId, sessionId))
    .run();

  return { sessionId, status: "matched", leadId, activityId: activityId ?? undefined, reason: "Manuelle Zuordnung" };
}

export function ignoreSession(sessionId: string): ImportOneResult {
  const row = db.select().from(hedySessions).where(eq(hedySessions.sessionId, sessionId)).get();
  if (!row) return { sessionId, status: "error", error: "Session nicht gefunden" };
  db.update(hedySessions)
    .set({ matchStatus: "ignored", matchReason: "Manuell ignoriert" })
    .where(eq(hedySessions.sessionId, sessionId))
    .run();
  return { sessionId, status: "skipped", reason: "Ignoriert" };
}
