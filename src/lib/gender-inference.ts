import { chat } from "./ai-client";

/**
 * VOE-178: Geschlecht aus Vorname per KI ableiten — fuer den Superchat-Sync,
 * damit WhatsApp-Vorlagen mit geschlechtsspezifischer Anrede (Herr/Frau)
 * korrekt gerendert werden. Superchat unterstuetzt nur "male" und "female".
 *
 * Caching: Module-level Map, damit gleiche Vornamen nicht mehrfach
 * KI-Calls verursachen.
 */

type Gender = "male" | "female";

const cache = new Map<string, Gender | null>();

function normalize(firstName: string): string {
  return firstName.trim().toLowerCase();
}

/**
 * Liefert das Geschlecht zu einem Vornamen oder null, wenn unklar.
 *
 * Bei API-Fehlern oder mehrdeutigen Vornamen wird null zurueckgegeben —
 * der Sync laeuft dann ohne gender-Feld weiter.
 */
export async function inferGender(firstName: string | null | undefined): Promise<Gender | null> {
  if (!firstName) return null;
  const key = normalize(firstName);
  if (!key) return null;

  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  try {
    const response = await chat([
      {
        role: "system",
        content:
          "Du bestimmst das wahrscheinlichste Geschlecht zu einem deutschen Vornamen. " +
          'Antworte AUSSCHLIESSLICH mit einem Wort: "male", "female" oder "unknown". ' +
          "Bei mehrdeutigen oder dir unbekannten Namen antworte mit unknown. Keine Erklaerungen.",
      },
      {
        role: "user",
        content: firstName,
      },
    ]);
    const raw = response.content.trim().toLowerCase();
    let result: Gender | null = null;
    if (raw.startsWith("male")) result = "male";
    else if (raw.startsWith("female")) result = "female";
    cache.set(key, result);
    return result;
  } catch (err) {
    console.log(`[gender-inference] Fehler fuer "${firstName}":`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Nur fuer Tests: Cache leeren. */
export function clearGenderCache(): void {
  cache.clear();
}
