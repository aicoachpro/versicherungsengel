import { chat } from "./ai-client";

/**
 * VOE-178: Geschlecht aus Vorname per KI ableiten — fuer den Superchat-Sync,
 * damit WhatsApp-Vorlagen mit geschlechtsspezifischer Anrede (Herr/Frau)
 * korrekt gerendert werden. Superchat unterstuetzt nur "male" und "female".
 *
 * VOE-190: Vorher Anrede ("Frau"/"Herr") direkt mappen und Titel ("Dr.", "Prof.")
 * ueberspringen — sonst landet die Anrede selbst als "Vorname" bei der KI und
 * sie liefert "unknown".
 *
 * Caching: Module-level Map, damit gleiche Vornamen nicht mehrfach
 * KI-Calls verursachen.
 */

type Gender = "male" | "female";

const cache = new Map<string, Gender | null>();

// Anrede → Geschlecht (eindeutig, kein KI-Call noetig)
const SALUTATION_GENDER: Record<string, Gender> = {
  frau: "female",
  fr: "female",
  "fr.": "female",
  mrs: "female",
  "mrs.": "female",
  ms: "female",
  "ms.": "female",
  miss: "female",
  herr: "male",
  hr: "male",
  "hr.": "male",
  mr: "male",
  "mr.": "male",
};

// Akademische / berufliche Titel — werden uebersprungen, liefern kein Geschlecht
const TITLES = new Set([
  "dr",
  "dr.",
  "prof",
  "prof.",
  "dipl",
  "dipl.",
  "mag",
  "mag.",
  "ing",
  "ing.",
  "med",
  "med.",
  "phd",
  "ph.d.",
  "msc",
  "m.sc.",
  "bsc",
  "b.sc.",
  "ma",
  "m.a.",
  "ba",
  "b.a.",
]);

function normalize(firstName: string): string {
  return firstName.trim().toLowerCase();
}

/**
 * Zerlegt einen vollstaendigen Namen und liefert:
 * - explizites Geschlecht aus Anrede (Frau/Herr) wenn vorhanden
 * - den ersten "echten" Vornamen ohne Anrede/Titel
 * - den Rest als Nachname (ebenfalls ohne Anrede/Titel)
 *
 * Beispiele:
 *   "Frau Andrea Neumann"   → { gender: "female", firstName: "Andrea", lastName: "Neumann" }
 *   "Herr Dr. Markus Sturm" → { gender: "male",   firstName: "Markus", lastName: "Sturm" }
 *   "Dr. Andrea Neumann"    → { gender: null,     firstName: "Andrea", lastName: "Neumann" }
 *   "Andrea Neumann"        → { gender: null,     firstName: "Andrea", lastName: "Neumann" }
 *   "Tanzschule Rhythmus"   → { gender: null,     firstName: "Tanzschule", lastName: "Rhythmus" }
 */
export function extractNameParts(fullName: string | null | undefined): {
  gender: Gender | null;
  firstName: string;
  lastName: string;
} {
  if (!fullName) return { gender: null, firstName: "", lastName: "" };
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { gender: null, firstName: "", lastName: "" };

  let gender: Gender | null = null;
  let i = 0;

  // Anrede an Position 0 → Geschlecht ableiten und Token verwerfen
  if (tokens.length > 1) {
    const first = tokens[0].toLowerCase();
    const salutation = SALUTATION_GENDER[first];
    if (salutation) {
      gender = salutation;
      i = 1;
    }
  }

  // Akademische Titel ueberspringen ("Dr.", "Prof.", evtl. mehrere hintereinander).
  // Letztes Token nicht ueberspringen, sonst bleibt kein Name uebrig.
  while (i < tokens.length - 1 && TITLES.has(tokens[i].toLowerCase())) {
    i++;
  }

  const firstName = tokens[i] || "";
  const lastName = tokens.slice(i + 1).join(" ");
  return { gender, firstName, lastName };
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

/**
 * VOE-190: High-Level-Hilfsfunktion fuer den Superchat-Sync.
 * - Zerlegt den vollen Namen, erkennt Anrede direkt
 * - Faellt auf KI-Inferenz zurueck wenn keine Anrede vorhanden
 * - Liefert null wenn nichts ableitbar (Sync laeuft dann ohne gender weiter)
 *
 * Loggt eine Zeile wenn am Ende null herauskommt — damit beim Debugging
 * im Container-Log ersichtlich ist, welcher Name nicht aufgeloest werden konnte.
 */
export async function inferGenderFromFullName(
  fullName: string | null | undefined,
): Promise<Gender | null> {
  const { gender, firstName } = extractNameParts(fullName);
  if (gender) return gender;

  const aiGender = await inferGender(firstName);
  if (!aiGender) {
    console.log(
      `[gender-inference] kein Geschlecht ableitbar — fullName="${fullName ?? ""}", firstName="${firstName}"`,
    );
  }
  return aiGender;
}

/** Nur fuer Tests: Cache leeren. */
export function clearGenderCache(): void {
  cache.clear();
}
