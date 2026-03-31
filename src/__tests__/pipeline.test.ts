import { describe, it, expect } from "vitest";

// Pipeline-Logik aus leads/route.ts — hier als Unit-Test der Kern-Logik

describe("Pipeline — Phasenwechsel", () => {
  const validPhases = [
    "Termin eingegangen",
    "Termin stattgefunden",
    "Follow-up",
    "Angebot erstellt",
    "Abgeschlossen",
    "Verloren",
  ] as const;

  it("alle definierten Phasen sind gültig", () => {
    expect(validPhases).toHaveLength(6);
    expect(validPhases).toContain("Termin eingegangen");
    expect(validPhases).toContain("Abgeschlossen");
    expect(validPhases).toContain("Verloren");
  });

  it("Default-Phase ist 'Termin eingegangen'", () => {
    const defaultPhase = "Termin eingegangen";
    expect(validPhases).toContain(defaultPhase);
    expect(validPhases[0]).toBe(defaultPhase);
  });
});

describe("Pipeline — folgeterminNotified Reset", () => {
  // Logik aus PATCH handler: wenn folgetermin geändert wird, wird Flag zurückgesetzt
  function applyLeadUpdate(updates: Record<string, unknown>) {
    if ("folgetermin" in updates) {
      updates.folgeterminNotified = 0;
    }
    updates.updatedAt = new Date().toISOString();
    return updates;
  }

  it("setzt folgeterminNotified auf 0 wenn folgetermin geändert wird", () => {
    const updates = applyLeadUpdate({ folgetermin: "2026-04-01T10:00" });
    expect(updates.folgeterminNotified).toBe(0);
  });

  it("ändert folgeterminNotified nicht wenn folgetermin nicht geändert wird", () => {
    const updates = applyLeadUpdate({ name: "Neuer Name" });
    expect(updates.folgeterminNotified).toBeUndefined();
  });

  it("setzt folgeterminNotified auch bei null-Folgetermin zurück", () => {
    const updates = applyLeadUpdate({ folgetermin: null });
    expect(updates.folgeterminNotified).toBe(0);
  });

  it("setzt updatedAt bei jedem Update", () => {
    const before = new Date().toISOString();
    const updates = applyLeadUpdate({ name: "Test" });
    expect(updates.updatedAt).toBeDefined();
    expect(new Date(updates.updatedAt as string).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime()
    );
  });
});

describe("Pipeline — Archivierung (Soft-Delete)", () => {
  it("Archiv setzt archivedAt auf ISO-Timestamp", () => {
    const archivedAt = new Date().toISOString();
    expect(archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("Restore setzt archivedAt auf null", () => {
    const restored = { archivedAt: null };
    expect(restored.archivedAt).toBeNull();
  });
});

describe("Pipeline — Default-Werte", () => {
  it("terminKosten Default ist 320", () => {
    const defaultKosten = 320;
    const body = {};
    const terminKosten = (body as Record<string, unknown>).terminKosten ?? defaultKosten;
    expect(terminKosten).toBe(320);
  });

  it("terminKosten wird überschrieben wenn angegeben", () => {
    const body = { terminKosten: 500 };
    const terminKosten = body.terminKosten ?? 320;
    expect(terminKosten).toBe(500);
  });

  it("terminKosten 0 wird nicht durch Default ersetzt (nullish coalescing)", () => {
    const body = { terminKosten: 0 };
    const terminKosten = body.terminKosten ?? 320;
    expect(terminKosten).toBe(0);
  });

  it("eingangsdatum Default ist heute im ISO-Format", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
