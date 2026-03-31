// Deutsches Datum (TT.MM.JJJJ HH:MM) → ISO (JJJJ-MM-TTTHH:MM)
export function parseTermin(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}`;
  }
  // Nur Datum ohne Uhrzeit: TT.MM.JJJJ
  const dateOnly = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dateOnly) {
    return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;
  }
  // Bereits ISO-Format oder anderes gültiges Format
  return value;
}
