import { describe, it, expect } from "vitest";
import { extractNameParts } from "@/lib/gender-inference";

describe("extractNameParts", () => {
  it("erkennt 'Frau' als weibliche Anrede und entfernt sie aus dem Namen", () => {
    expect(extractNameParts("Frau Andrea Neumann")).toEqual({
      gender: "female",
      firstName: "Andrea",
      lastName: "Neumann",
    });
  });

  it("erkennt 'Herr' als maennliche Anrede", () => {
    expect(extractNameParts("Herr Markus Sturm")).toEqual({
      gender: "male",
      firstName: "Markus",
      lastName: "Sturm",
    });
  });

  it("erkennt englische Anreden 'Mr.' / 'Mrs.' / 'Ms.'", () => {
    expect(extractNameParts("Mr. John Smith").gender).toBe("male");
    expect(extractNameParts("Mrs. Jane Doe").gender).toBe("female");
    expect(extractNameParts("Ms. Anne Frank").gender).toBe("female");
  });

  it("ueberspringt akademische Titel ohne Anrede", () => {
    expect(extractNameParts("Dr. Andrea Neumann")).toEqual({
      gender: null,
      firstName: "Andrea",
      lastName: "Neumann",
    });
  });

  it("ueberspringt mehrere Titel hintereinander mit Anrede", () => {
    expect(extractNameParts("Herr Prof. Dr. Markus Sturm")).toEqual({
      gender: "male",
      firstName: "Markus",
      lastName: "Sturm",
    });
  });

  it("verarbeitet Namen ohne Anrede unveraendert", () => {
    expect(extractNameParts("Andrea Neumann")).toEqual({
      gender: null,
      firstName: "Andrea",
      lastName: "Neumann",
    });
  });

  it("behandelt Firmennamen ohne Person robust", () => {
    expect(extractNameParts("Tanzschule Rhythmus")).toEqual({
      gender: null,
      firstName: "Tanzschule",
      lastName: "Rhythmus",
    });
  });

  it("liefert leere Strings bei null/undefined/leerem Input", () => {
    expect(extractNameParts(null)).toEqual({ gender: null, firstName: "", lastName: "" });
    expect(extractNameParts(undefined)).toEqual({ gender: null, firstName: "", lastName: "" });
    expect(extractNameParts("")).toEqual({ gender: null, firstName: "", lastName: "" });
    expect(extractNameParts("   ")).toEqual({ gender: null, firstName: "", lastName: "" });
  });

  it("behandelt Einzelnamen ohne Nachname", () => {
    expect(extractNameParts("Andrea")).toEqual({
      gender: null,
      firstName: "Andrea",
      lastName: "",
    });
  });

  it("ueberspringt Titel nicht, wenn nichts dahinter kommt", () => {
    // "Dr." allein bleibt stehen, sonst waere firstName leer
    expect(extractNameParts("Dr.")).toEqual({
      gender: null,
      firstName: "Dr.",
      lastName: "",
    });
  });

  it("normalisiert Mehrfach-Whitespace", () => {
    expect(extractNameParts("  Frau   Andrea    Neumann  ")).toEqual({
      gender: "female",
      firstName: "Andrea",
      lastName: "Neumann",
    });
  });

  it("Anrede wird nicht als Geschlecht erkannt, wenn sie das einzige Token ist", () => {
    // Schutz: "Frau" allein ohne Name → kein gender, "Frau" landet als firstName
    expect(extractNameParts("Frau")).toEqual({
      gender: null,
      firstName: "Frau",
      lastName: "",
    });
  });

  it("kurze Anrede 'Hr.' / 'Fr.' wird erkannt", () => {
    expect(extractNameParts("Fr. Andrea Neumann").gender).toBe("female");
    expect(extractNameParts("Hr. Markus Sturm").gender).toBe("male");
  });
});
