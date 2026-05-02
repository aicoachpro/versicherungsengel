/**
 * Hilfsfunktionen fuer das Provider-Pause-Konzept (VOE-174).
 *
 * Ein Provider gilt als "pausiert", wenn `pausedUntil` gesetzt ist und das
 * Datum heute oder in der Zukunft liegt. Pausierte Provider:
 * - nehmen keine neuen Leads mehr an (Mail-Cron, Lead-Dialog)
 * - bleiben fuer bestehende Leads voll funktional (Reports, Provisionen)
 * - werden in der Soll-Lead-Berechnung mit min=0 fuer pausierte Monate
 *   beruecksichtigt, damit kein kuenstliches Defizit entsteht.
 */

export function isProviderPaused(
  pausedUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!pausedUntil) return false;
  const today = now.toISOString().slice(0, 10);
  return pausedUntil >= today;
}

/**
 * Liefert true, wenn der Provider im Monat `yyyymm` (YYYY-MM) durchgaengig
 * pausiert war oder sein wird. Wird fuer die Soll-Berechnung am Dashboard
 * benutzt: pausierte Monate fliessen mit min=0 ein.
 *
 * Heuristik: pausedUntil >= letzter Tag des Monats → ganzer Monat pausiert.
 */
export function isMonthFullyPaused(
  pausedUntil: string | null | undefined,
  yearMonth: string,
): boolean {
  if (!pausedUntil) return false;
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return false;
  // Letzter Tag des Monats als YYYY-MM-DD
  const lastDay = new Date(Date.UTC(year, month, 0));
  const lastDayStr = lastDay.toISOString().slice(0, 10);
  return pausedUntil >= lastDayStr;
}
