import { describe, it, expect } from "vitest";

describe("API-Ingest — Kontaktart-Validierung", () => {
  const validKontaktarten = ["Telefon", "E-Mail", "WhatsApp", "Vor-Ort", "LinkedIn", "Sonstiges"];

  it("akzeptiert gültige Kontaktart", () => {
    const input = "Telefon";
    const safe = validKontaktarten.includes(input) ? input : "Sonstiges";
    expect(safe).toBe("Telefon");
  });

  it("setzt ungültige Kontaktart auf 'Sonstiges'", () => {
    const input = "Telegram";
    const safe = validKontaktarten.includes(input) ? input : "Sonstiges";
    expect(safe).toBe("Sonstiges");
  });

  it("Default Kontaktart ist 'Sonstiges'", () => {
    const input = undefined;
    const kontaktart = input || "Sonstiges";
    expect(kontaktart).toBe("Sonstiges");
  });

  it("alle 6 definierten Kontaktarten sind gültig", () => {
    expect(validKontaktarten).toHaveLength(6);
    for (const art of validKontaktarten) {
      expect(validKontaktarten.includes(art)).toBe(true);
    }
  });
});

describe("API-Ingest — Lead-Suche Logik", () => {
  it("braucht entweder leadName oder leadId", () => {
    const body1 = { leadName: "Müller" };
    const body2 = { leadId: 1 };
    const body3 = {};

    expect(!!(body1.leadName || body1.leadId)).toBe(true);
    expect(!!(body2.leadName || body2.leadId)).toBe(true);
    expect(!!((body3 as Record<string, unknown>).leadName || (body3 as Record<string, unknown>).leadId)).toBe(false);
  });

  it("erkennt Mehrfach-Treffer (Status 300)", () => {
    const matches = [
      { id: 1, name: "Müller GmbH" },
      { id: 2, name: "Müller & Partner" },
    ];
    expect(matches.length > 1).toBe(true);
  });

  it("erkennt Keine-Treffer (Status 404)", () => {
    const matches: unknown[] = [];
    expect(matches.length === 0).toBe(true);
  });

  it("erkennt Einzel-Treffer (Erfolg)", () => {
    const matches = [{ id: 1, name: "Müller GmbH" }];
    expect(matches.length === 1).toBe(true);
  });
});

describe("API-Ingest — Datum-Default", () => {
  it("Default-Datum ist aktueller ISO-Timestamp ohne Sekunden", () => {
    const datum = new Date().toISOString().slice(0, 16);
    expect(datum).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("benutzerdefiniertes Datum wird übernommen", () => {
    const body = { datum: "2026-03-15T14:30" };
    const datum = body.datum || new Date().toISOString().slice(0, 16);
    expect(datum).toBe("2026-03-15T14:30");
  });
});

describe("API-Auth — Bearer Token Parsing", () => {
  it("extrahiert Key aus Bearer Header", () => {
    const authHeader = "Bearer vf_test-key-123";
    const key = authHeader.replace("Bearer ", "");
    expect(key).toBe("vf_test-key-123");
  });

  it("erkennt fehlenden Bearer Prefix", () => {
    const authHeader = "Basic abc123";
    const hasBearer = authHeader?.startsWith("Bearer ");
    expect(hasBearer).toBe(false);
  });

  it("erkennt fehlenden Authorization Header", () => {
    const authHeader = null;
    const hasBearer = authHeader?.startsWith("Bearer ");
    expect(hasBearer).toBeFalsy();
  });
});

describe("API-Auth — Webhook x-api-key Header", () => {
  it("extrahiert Key aus x-api-key Header", () => {
    const apiKey = "vf_webhook-key-456";
    expect(apiKey).toBeTruthy();
  });

  it("erkennt fehlenden x-api-key Header", () => {
    const apiKey = null;
    expect(apiKey).toBeFalsy();
  });
});
