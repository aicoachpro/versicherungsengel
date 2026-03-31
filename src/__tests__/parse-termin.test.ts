import { describe, it, expect } from "vitest";
import { parseTermin } from "@/lib/parse-termin";

describe("parseTermin", () => {
  it("parst deutsches Datum mit Uhrzeit (TT.MM.JJJJ HH:MM)", () => {
    expect(parseTermin("15.03.2026 14:30")).toBe("2026-03-15T14:30");
  });

  it("parst deutsches Datum ohne Uhrzeit (TT.MM.JJJJ)", () => {
    expect(parseTermin("01.12.2025")).toBe("2025-12-01");
  });

  it("gibt ISO-Format unverändert zurück", () => {
    expect(parseTermin("2026-03-15T14:30")).toBe("2026-03-15T14:30");
  });

  it("gibt null für null/undefined zurück", () => {
    expect(parseTermin(null)).toBeNull();
    expect(parseTermin(undefined)).toBeNull();
  });

  it("gibt leeren String als Fallback zurück", () => {
    expect(parseTermin("")).toBeNull();
  });

  it("gibt unbekanntes Format unverändert zurück", () => {
    expect(parseTermin("morgen")).toBe("morgen");
    expect(parseTermin("2026/03/15")).toBe("2026/03/15");
  });

  it("parst Randdatum korrekt (Silvester)", () => {
    expect(parseTermin("31.12.2025 23:59")).toBe("2025-12-31T23:59");
  });

  it("parst Randdatum korrekt (Neujahr)", () => {
    expect(parseTermin("01.01.2026 00:00")).toBe("2026-01-01T00:00");
  });
});
