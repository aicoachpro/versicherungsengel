import { describe, it, expect } from "vitest";
import { summarizeBundle } from "@/lib/hedy/summarize";

describe("summarizeBundle", () => {
  it("baut Titel, Recap und Highlights in Markdown", () => {
    const md = summarizeBundle({
      session: {
        id: "s1",
        title: "Kundentermin Mueller",
        startedAt: "2026-04-21T10:00:00.000Z",
        duration: 1800,
        participants: [{ name: "Hans Mueller", email: "h@m.de" }],
        recap: "Kunde will KFZ und Haftpflicht.",
      },
      highlights: [
        { id: "h1", title: "KFZ", quote: "Ich brauche eine KFZ-Versicherung", insight: "Cross-Selling moeglich" },
      ],
      todos: [
        { id: "t1", title: "Angebot schicken", dueDate: "2026-04-25T10:00:00Z" },
      ],
    });

    expect(md).toContain("# Kundentermin Mueller");
    expect(md).toContain("Dauer: 30 min");
    expect(md).toContain("Hans Mueller");
    expect(md).toContain("## Zusammenfassung");
    expect(md).toContain("Kunde will KFZ");
    expect(md).toContain("## Highlights");
    expect(md).toContain("**KFZ**");
    expect(md).toContain("## Offene To-Dos");
    expect(md).toContain("- [ ] Angebot schicken");
    expect(md).toContain("Session s1");
  });

  it("funktioniert auch mit minimaler Session (nur id)", () => {
    const md = summarizeBundle({
      session: { id: "x" },
      highlights: [],
      todos: [],
    });
    expect(md).toContain("Session x");
    expect(md).not.toContain("## Highlights");
    expect(md).not.toContain("## Zusammenfassung");
  });

  it("faellt elegant auf Description zurueck wenn kein Titel beim Todo", () => {
    const md = summarizeBundle({
      session: { id: "s1" },
      highlights: [],
      todos: [{ id: "t1", description: "Beratung nachbereiten" }],
    });
    expect(md).toContain("- [ ] Beratung nachbereiten");
  });
});
