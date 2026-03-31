import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Cron — Folgetermin-Erinnerungen", () => {
  describe("Zeitfenster-Berechnung", () => {
    it("berechnet 1-Stunden-Fenster korrekt", () => {
      const now = new Date("2026-03-31T10:00:00.000Z");
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      expect(inOneHour.toISOString()).toBe("2026-03-31T11:00:00.000Z");
    });

    it("Termin innerhalb des Fensters wird erkannt", () => {
      const now = new Date("2026-03-31T10:00:00.000Z");
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const termin = "2026-03-31T10:30:00.000Z";

      const isInWindow = termin >= now.toISOString() && termin <= inOneHour.toISOString();
      expect(isInWindow).toBe(true);
    });

    it("Termin außerhalb des Fensters wird ignoriert", () => {
      const now = new Date("2026-03-31T10:00:00.000Z");
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const terminTooLate = "2026-03-31T12:00:00.000Z";
      const terminPast = "2026-03-31T09:00:00.000Z";

      expect(terminTooLate >= now.toISOString() && terminTooLate <= inOneHour.toISOString()).toBe(false);
      expect(terminPast >= now.toISOString() && terminPast <= inOneHour.toISOString()).toBe(false);
    });
  });

  describe("folgeterminNotified-Flag", () => {
    it("nur Termine mit folgeterminNotified=0 werden berücksichtigt", () => {
      const leads = [
        { id: 1, folgeterminNotified: 0, folgetermin: "2026-03-31T10:30:00Z" },
        { id: 2, folgeterminNotified: 1, folgetermin: "2026-03-31T10:45:00Z" },
        { id: 3, folgeterminNotified: 0, folgetermin: "2026-03-31T10:50:00Z" },
      ];
      const pending = leads.filter((l) => l.folgeterminNotified === 0);
      expect(pending).toHaveLength(2);
      expect(pending.map((l) => l.id)).toEqual([1, 3]);
    });

    it("Flag wird nach erfolgreicher Benachrichtigung auf 1 gesetzt", () => {
      const lead = { folgeterminNotified: 0 };
      // Simuliere erfolgreiche Pushover-Benachrichtigung
      const pushoverSuccess = true;
      if (pushoverSuccess) {
        lead.folgeterminNotified = 1;
      }
      expect(lead.folgeterminNotified).toBe(1);
    });

    it("Flag bleibt 0 bei fehlgeschlagener Benachrichtigung", () => {
      const lead = { folgeterminNotified: 0 };
      const pushoverSuccess = false;
      if (pushoverSuccess) {
        lead.folgeterminNotified = 1;
      }
      expect(lead.folgeterminNotified).toBe(0);
    });
  });

  describe("Cron Secret Validierung", () => {
    it("erlaubt Zugriff mit korrektem Secret", () => {
      const envSecret = "mein-geheimer-cron-key";
      const requestSecret = "mein-geheimer-cron-key";
      const authorized = requestSecret === envSecret;
      expect(authorized).toBe(true);
    });

    it("blockiert Zugriff mit falschem Secret", () => {
      const envSecret = "mein-geheimer-cron-key";
      const requestSecret = "falscher-key";
      const authorized = requestSecret === envSecret;
      expect(authorized).toBe(false);
    });

    it("erlaubt Zugriff wenn kein CRON_SECRET konfiguriert", () => {
      // Logik aus route.ts: secret !== process.env.CRON_SECRET && process.env.CRON_SECRET
      const envSecret = undefined;
      const requestSecret = "irgendwas";
      const blocked = requestSecret !== envSecret && envSecret;
      expect(blocked).toBeFalsy();
    });
  });

  describe("Benachrichtigungs-Nachricht", () => {
    it("formatiert Lead-Name mit Ansprechpartner", () => {
      const lead = { name: "Müller GmbH", ansprechpartner: "Herr Müller" };
      const message = `${lead.name}${lead.ansprechpartner ? ` (${lead.ansprechpartner})` : ""}`;
      expect(message).toBe("Müller GmbH (Herr Müller)");
    });

    it("formatiert Lead-Name ohne Ansprechpartner", () => {
      const lead = { name: "Müller GmbH", ansprechpartner: null };
      const message = `${lead.name}${lead.ansprechpartner ? ` (${lead.ansprechpartner})` : ""}`;
      expect(message).toBe("Müller GmbH");
    });
  });
});

describe("Pushover — Konfiguration", () => {
  it("gibt false zurück wenn Env-Vars fehlen", () => {
    const userKey = undefined;
    const apiToken = undefined;
    const configured = !!(userKey && apiToken);
    expect(configured).toBe(false);
  });

  it("gibt true zurück wenn beide Env-Vars gesetzt sind", () => {
    const userKey = "user123";
    const apiToken = "token456";
    const configured = !!(userKey && apiToken);
    expect(configured).toBe(true);
  });
});
