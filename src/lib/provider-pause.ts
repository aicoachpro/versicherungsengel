/**
 * Hilfsfunktionen fuer das Provider-Pause-Konzept (VOE-174, erweitert in VOE-175).
 *
 * Ein Provider gilt als "pausiert", wenn `pausedUntil` gesetzt ist und das
 * Datum heute oder in der Zukunft liegt. Pausierte Provider:
 * - nehmen keine neuen Leads mehr an (Mail-Cron, Lead-Dialog)
 * - bleiben fuer bestehende Leads voll funktional (Reports, Provisionen)
 * - werden in der Soll-Lead-Berechnung mit min=0 fuer pausierte Monate
 *   beruecksichtigt, damit kein kuenstliches Defizit entsteht.
 *
 * Der Pause-Zeitraum wird durch `pausedFrom` und `pausedUntil` definiert.
 * Fuer Backwards-Kompatibilitaet faellt `pausedFrom` auf den ersten Tag des
 * Monats zurueck, in dem `pausedUntil` liegt.
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
 * Liefert den effektiven Pause-Beginn. Wenn `pausedFrom` nicht gesetzt ist,
 * wird der erste Tag des Monats angenommen, in dem `pausedUntil` liegt
 * (Backwards-Kompatibilitaet fuer VOE-174-Anbieter).
 */
function effectivePausedFrom(
  pausedFrom: string | null | undefined,
  pausedUntil: string,
): string {
  if (pausedFrom) return pausedFrom;
  const [y, m] = pausedUntil.split("-");
  return `${y}-${m}-01`;
}

/**
 * Liefert true, wenn der Pause-Zeitraum den Monat `yearMonth` (YYYY-MM)
 * ueberlappt. Wird fuer die Soll-Berechnung am Dashboard benutzt: pausierte
 * Monate fliessen mit min=0 ein.
 *
 * Ueberlappung: pausedFrom <= letzter Tag des Monats AND pausedUntil >= erster
 * Tag des Monats.
 */
export function isMonthFullyPaused(
  pausedUntil: string | null | undefined,
  yearMonth: string,
  pausedFrom: string | null | undefined = null,
): boolean {
  if (!pausedUntil) return false;
  const [yStr, mStr] = yearMonth.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return false;
  const firstDay = `${yStr}-${mStr.padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const start = effectivePausedFrom(pausedFrom, pausedUntil);
  return start <= lastDay && pausedUntil >= firstDay;
}
