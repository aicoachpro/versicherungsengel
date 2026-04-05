/**
 * Parser für Provisions-CSV-Dateien (Semikolon-getrennt, deutsches Zahlenformat).
 *
 * Die CSV-Dateien haben typischerweise Mojibake-Encoding (Latin1/Windows-1252
 * mit UTF-8 BOM), daher werden bekannte Mojibake-Sequenzen korrigiert.
 */

export interface ParsedProvision {
  buchungsDatum: string;
  versNehmer: string;
  bsz: string | null;
  versNummer: string | null;
  datevKonto: string | null;
  kontoName: string | null;
  buchungstext: string | null;
  erfolgsDatum: string | null;
  vtnr: string | null;
  provBasis: number;
  provSatz: number;
  betrag: number;
}

/**
 * Korrigiert Mojibake-Encoding (UTF-8 bytes als Latin1 gelesen).
 */
function fixMojibake(text: string): string {
  const replacements: [string, string][] = [
    ["Ã¤", "ä"],
    ["Ã¶", "ö"],
    ["Ã¼", "ü"],
    ["Ã\u009f", "ß"],
    ["ÃŸ", "ß"],
    ["Ã„", "Ä"],
    ["Ã–", "Ö"],
    ["Ãœ", "Ü"],
    ["Ã©", "é"],
    ["Ã¨", "è"],
    ["Ã ", "à"],
  ];
  let fixed = text;
  for (const [from, to] of replacements) {
    fixed = fixed.split(from).join(to);
  }
  return fixed;
}

/**
 * Konvertiert deutsches Datum "01.04.2026" → ISO "2026-04-01"
 */
function parseGermanDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  const trimmed = dateStr.trim();
  const parts = trimmed.split(".");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return trimmed;
}

/**
 * Parst eine deutsche Zahl: "1.500,00" → 1500.00, "-320,00" → -320.00
 * Auch Prozent: "12,0%" → 12.0
 */
function parseGermanNumber(value: string): number {
  if (!value || !value.trim()) return 0;
  let cleaned = value.trim().replace(/%$/, "");
  // Tausender-Punkt entfernen, Dezimal-Komma → Punkt
  cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parst den CSV-Text und gibt ein Array von ParsedProvision zurück.
 *
 * CSV-Struktur:
 * - Zeile 1: Überschrift "Buchungen | ..."
 * - Zeile 2: leer (nur Semikolons)
 * - Zeile 3: Spaltenheader
 * - Zeile 4: Total-Zeile
 * - Zeile 5+: Datenzeilen
 */
export function parseProvisionCSV(csvText: string): ParsedProvision[] {
  const fixed = fixMojibake(csvText);

  const lines = fixed.split(/\r?\n/);
  const results: ParsedProvision[] = [];

  // Überspringe Header-Zeilen (erste 3) und Total-Zeile (4.)
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(";");

    // Leere Zeilen oder Zeilen ohne Vers.Nehmer überspringen
    const buchungsDatum = cols[0]?.trim() || "";
    const versNehmer = cols[1]?.trim() || "";

    if (!versNehmer && !buchungsDatum) continue;
    if (!versNehmer) continue;

    // Zeilen ohne echten Kundennamen überspringen (Aggregate/Header-Zeilen)
    if (/^\s*;?0{4}/.test(versNehmer) || versNehmer.length < 2) continue;

    // "Total"-Zeile überspringen (falls weitere Total-Zeilen existieren)
    if (versNehmer.toLowerCase() === "total" || buchungsDatum.toLowerCase() === "total") continue;

    // DATEV Konto: Spalte 4 ist Nummer, Spalte 5 ist Name
    const datevKonto = cols[4]?.trim() || null;
    const kontoName = cols[5]?.trim() || null;

    results.push({
      buchungsDatum: parseGermanDate(buchungsDatum),
      versNehmer,
      bsz: cols[2]?.trim() || null,
      versNummer: cols[3]?.trim() || null,
      datevKonto,
      kontoName,
      buchungstext: cols[6]?.trim() || null,
      erfolgsDatum: cols[7]?.trim() ? parseGermanDate(cols[7].trim()) : null,
      vtnr: cols[8]?.trim() || null,
      // Spalte 9 ist ein Leerzeichen/Separator
      provBasis: parseGermanNumber(cols[10] || ""),
      provSatz: parseGermanNumber(cols[11] || ""),
      betrag: parseGermanNumber(cols[12] || ""),
    });
  }

  return results;
}
