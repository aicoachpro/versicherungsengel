import { db } from "@/db";
import { leads } from "@/db/schema";
import { and, gte, lte, or, isNotNull } from "drizzle-orm";
import type { HedySession } from "./types";

export interface MatchResult {
  leadId: number | null;
  confidence: number; // 0..1
  reason: string;
  candidates: number; // Anzahl geprueft
}

interface LeadCandidate {
  id: number;
  name: string;
  ansprechpartner: string | null;
  email: string | null;
  termin: string | null;
  folgetermin: string | null;
}

/**
 * Matcht eine Hedy-Session gegen Leads basierend auf:
 * 1. Zeitfenster um session.startedAt (termin ODER folgetermin faellt in +/- windowMinutes)
 * 2. Participant-Match gegen Lead.email / Lead.ansprechpartner / Lead.name
 */
export function matchSessionToLead(
  session: HedySession,
  opts: { windowMinutes?: number } = {},
): MatchResult {
  const windowMinutes = opts.windowMinutes ?? 240;

  const started = session.startedAt ? new Date(session.startedAt) : null;
  if (!started || Number.isNaN(started.getTime())) {
    return { leadId: null, confidence: 0, reason: "Session hat keinen gueltigen startedAt", candidates: 0 };
  }

  const lower = new Date(started.getTime() - windowMinutes * 60_000).toISOString();
  const upper = new Date(started.getTime() + windowMinutes * 60_000).toISOString();

  // Alle Leads mit Termin oder Folgetermin im Fenster
  const candidates = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      email: leads.email,
      termin: leads.termin,
      folgetermin: leads.folgetermin,
    })
    .from(leads)
    .where(
      or(
        and(isNotNull(leads.termin), gte(leads.termin, lower), lte(leads.termin, upper)),
        and(isNotNull(leads.folgetermin), gte(leads.folgetermin, lower), lte(leads.folgetermin, upper)),
      ),
    )
    .all() as LeadCandidate[];

  if (candidates.length === 0) {
    return { leadId: null, confidence: 0, reason: "Kein Lead mit Termin in +/-4h Fenster", candidates: 0 };
  }

  // Participant-Match
  const participantEmails = new Set(
    (session.participants ?? []).map((p) => normalizeEmail(p.email)).filter(Boolean),
  );
  const participantNames = (session.participants ?? [])
    .map((p) => normalizeName(p.name))
    .filter(Boolean);

  type Scored = { lead: LeadCandidate; score: number; reasons: string[] };
  const scored: Scored[] = candidates.map((lead) => {
    const reasons: string[] = [];
    let score = 0.25; // Basis: liegt im Zeitfenster

    // Zeitnaehe: je naeher, desto hoeher
    const leadTime = lead.termin || lead.folgetermin;
    if (leadTime) {
      const diffMin = Math.abs((new Date(leadTime).getTime() - started.getTime()) / 60_000);
      if (diffMin <= 15) {
        score += 0.25;
        reasons.push(`Termin ${diffMin.toFixed(0)}min vom Sessionstart`);
      } else if (diffMin <= 60) {
        score += 0.15;
      }
    }

    // E-Mail-Match (stark)
    const leadEmail = normalizeEmail(lead.email);
    if (leadEmail && participantEmails.has(leadEmail)) {
      score += 0.5;
      reasons.push(`E-Mail-Match: ${lead.email}`);
    }

    // Name-Match (schwaecher)
    const leadNames = [normalizeName(lead.name), normalizeName(lead.ansprechpartner)].filter(Boolean);
    for (const pn of participantNames) {
      for (const ln of leadNames) {
        if (!pn || !ln) continue;
        if (pn.includes(ln) || ln.includes(pn)) {
          score += 0.3;
          reasons.push(`Name-Match: ${pn} <-> ${ln}`);
          break;
        }
      }
    }

    return { lead, score: Math.min(score, 1), reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];

  // Eindeutig, wenn best deutlich vor second liegt
  const unambiguous = !second || best.score - second.score >= 0.2;

  // Akzeptiere nur, wenn mehr als Basis-Zeitfenster (sonst unmatched)
  if (best.score < 0.45) {
    return {
      leadId: null,
      confidence: best.score,
      reason: `Zu schwacher Match (Top-Score ${best.score.toFixed(2)}; ${candidates.length} Kandidaten)`,
      candidates: candidates.length,
    };
  }

  if (!unambiguous) {
    return {
      leadId: null,
      confidence: best.score,
      reason: `Mehrdeutig: Top-Scores ${best.score.toFixed(2)} vs ${second!.score.toFixed(2)}`,
      candidates: candidates.length,
    };
  }

  return {
    leadId: best.lead.id,
    confidence: best.score,
    reason: best.reasons.join(" · ") || "Zeitfenster-Match",
    candidates: candidates.length,
  };
}

function normalizeEmail(e?: string | null): string {
  return (e || "").trim().toLowerCase();
}

function normalizeName(n?: string | null): string {
  return (n || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\s-]/gu, "");
}
