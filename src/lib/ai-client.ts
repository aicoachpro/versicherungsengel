import { getSetting } from "./settings";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
}

export async function chat(messages: ChatMessage[]): Promise<AIResponse> {
  const backend = getSetting("ai.backend") || "anthropic";

  if (backend === "anthropic") {
    return chatAnthropic(messages);
  }

  // LocalAI and custom both use OpenAI-compatible API
  return chatOpenAI(messages);
}

async function chatAnthropic(messages: ChatMessage[]): Promise<AIResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role !== "system");

  const response = await client.messages.create({
    model: getSetting("ai.model") || "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemMsg,
    messages: userMsgs.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return { content: textBlock?.text || "" };
}

async function chatOpenAI(messages: ChatMessage[]): Promise<AIResponse> {
  const backend = getSetting("ai.backend");
  const baseURL =
    backend === "localai"
      ? getSetting("ai.localaiUrl") || "http://localhost:8080"
      : getSetting("ai.customUrl");
  const apiKey =
    backend === "custom"
      ? getSetting("ai.customApiKey")
      : "not-needed"; // LocalAI doesn't need a key
  const model =
    getSetting("ai.model") ||
    (backend === "localai" ? "gpt-3.5-turbo" : "gpt-4");

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    baseURL: baseURL.replace(/\/+$/, "") + "/v1",
    apiKey,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 4096,
    temperature: 0.1,
  });

  return { content: response.choices[0]?.message?.content || "" };
}

// Lead-Extraktion mit JSON-Modus (Mistral-optimiert, wie n8n-Workflow)
export async function extractLeadFromEmail(emailText: string): Promise<string> {
  const backend = getSetting("ai.backend");
  const baseURL =
    backend === "localai"
      ? getSetting("ai.localaiUrl") || "http://localhost:8080"
      : getSetting("ai.customUrl");
  const apiKey =
    backend === "custom"
      ? getSetting("ai.customApiKey")
      : "not-needed";
  const model = getSetting("ai.model") || "mistral-small-latest";

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    baseURL: baseURL.replace(/\/+$/, "") + "/v1",
    apiKey,
  });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content:
          "Du bist ein Datenextraktions-Assistent fuer Versicherungsvermittler.\n" +
          "Die E-Mail kann von verschiedenen Lead-Anbietern kommen (Versicherungsengel, LeadCloser, CheckDirect, direkte Anfrage etc.) und in verschiedenen Formaten sein:\n" +
          "- Strukturiert als Label-Wert-Liste (z.B. 'Name: Max Mustermann')\n" +
          "- Strukturiert als Tabelle\n" +
          "- Freitext-E-Mail\n" +
          "- HTML-formatierte Mail\n\n" +
          "Extrahiere alle Lead-Daten als JSON mit EXAKT diesen Feldern:\n" +
          "- name (Firmenname, bei Privatperson der volle Name)\n" +
          "- ansprechpartner (Person als Kontaktperson)\n" +
          "- email, telefon, website\n" +
          "- strasse, plz, ort\n" +
          "- gewerbeart (hauptberuflich/nebenberuflich, nur bei Gewerbe-Leads)\n" +
          "- branche (Bau, Handwerk, Dienstleistung, Produktion, IT, Gesundheit, Logistik, Handel, Gastronomie, Immobilien, Sonstiges)\n" +
          "- unternehmensgroesse (1–9, 10–49, 50–199, 200–999, 1000+)\n" +
          "- umsatzklasse (<1 Mio, 1–5 Mio, 5–20 Mio, 20–100 Mio, >100 Mio)\n" +
          "- notizen (alle zusaetzlichen relevanten Infos aus der Mail)\n" +
          "- naechsterSchritt (was der Interessent als naechstes wuenscht)\n" +
          "- termin (Datum + Uhrzeit im Format TT.MM.JJJJ HH:MM, oder null falls kein Termin genannt)\n" +
          "- produkt (die Versicherungsart/Sparte nach der gefragt wird, z.B. 'Betriebshaftpflicht', 'KFZ-Versicherung', 'Private Krankenversicherung', 'Lebensversicherung', 'Rechtsschutz' etc.)\n\n" +
          "WICHTIGE REGELN:\n" +
          "1. Felder die nicht gefunden werden auf \"\" setzen (bzw. null bei termin)\n" +
          "2. Bei Freitext-Mails: Lies die Mail genau und extrahiere semantisch, auch wenn keine Labels vorhanden sind\n" +
          "3. Bei mehreren moeglichen Werten: nimm den spezifischsten\n" +
          "4. Das 'produkt'-Feld ist wichtig - versuche IMMER eine Sparte zu identifizieren\n" +
          "5. Bei Privatpersonen (keine Firma) setze 'name' auf den vollen Namen der Person\n\n" +
          "E-Mail-Inhalt:\n" + emailText,
      },
    ],
  });

  return response.choices[0]?.message?.content || "{}";
}

// Convenience: Lead-Extraktion aus Freitext
export async function extractLeadFromText(text: string): Promise<string> {
  return (
    await chat([
      {
        role: "system",
        content:
          'Du bist ein Datenextraktions-Assistent fuer Versicherungsvermittler. Extrahiere alle relevanten Lead-Daten aus dem folgenden Text und gib sie als JSON zurueck mit den Feldern: name, ansprechpartner, email, telefon, website, branche, strasse, plz, ort, unternehmensgroesse, notizen, produkt. Wenn ein Feld nicht gefunden wird, setze es auf "". Bestimme auch das passende Lead-Produkt aus dieser Liste: Beratung, Betriebshaftpflicht, Finanzierung, Firmenrechtsschutzversicherung, Firmenversicherung, Flottenversicherung, Haftpflichtversicherung, Hausratversicherung, Hundeversicherung, KFZ-Versicherung, Krankenzusatzversicherung, Pferdeversicherung, Rechtsschutzversicherung, Sterbegeldversicherung, Unfallversicherung, Vermögensschadenhaftpflicht, Wohngebäudeversicherung, Zahnzusatzversicherung, Private Krankenversicherung, Private Pflegeversicherung. Gib das Feld "produkt" mit dem exakten Namen zurueck.',
      },
      { role: "user", content: text },
    ])
  ).content;
}

// Convenience: Lead-Extraktion aus PDF-Text
export async function extractLeadFromPDF(pdfText: string): Promise<string> {
  return (
    await chat([
      {
        role: "system",
        content: `Du bist ein Datenextraktions-Assistent fuer Versicherungsvermittler.
Analysiere den folgenden PDF-Inhalt und extrahiere alle Lead-Daten.
Gib ein JSON-Array zurueck. Jeder Lead ist ein Objekt mit diesen Feldern:
- name (Firmenname, PFLICHT)
- ansprechpartner
- email
- telefon
- website
- branche (Bau, Handwerk, Dienstleistung, Produktion, IT, Gesundheit, Logistik, Handel, Gastronomie, Immobilien, Sonstiges)
- strasse
- plz
- ort
- unternehmensgroesse (1-9, 10-49, 50-199, 200-999, 1000+)
- umsatzklasse (<1 Mio, 1-5 Mio, 5-20 Mio, 20-100 Mio, >100 Mio)
- gewerbeart (hauptberuflich/nebenberuflich)
- notizen (zusaetzliche relevante Infos)
- confidence (0-1, wie sicher du bei der Extraktion bist. Unter 0.5 = sehr unsicher)

Setze leere Felder auf "". Antworte NUR mit dem JSON-Array.
Falls keine Lead-Daten erkennbar sind, antworte mit [].`,
      },
      { role: "user", content: pdfText },
    ])
  ).content;
}

// Produkt-Mapping: Lead-Anbieter-Sparten ↔ Gesellschafts-Produkte
// Mistral bekommt beide Listen und ordnet semantisch zu.
export async function matchProductsToLeadSparten(
  leadSparten: { id: number; name: string; kuerzel: string | null }[],
  companyProducts: { id: number; name: string }[]
): Promise<string> {
  const backend = getSetting("ai.backend");
  const baseURL =
    backend === "localai"
      ? getSetting("ai.localaiUrl") || "http://localhost:8080"
      : getSetting("ai.customUrl");
  const apiKey = backend === "custom" ? getSetting("ai.customApiKey") : "not-needed";
  const model = getSetting("ai.model") || "mistral-small-latest";

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    baseURL: baseURL.replace(/\/+$/, "") + "/v1",
    apiKey,
  });

  const leadListe = leadSparten
    .map((s) => `${s.id}: ${s.kuerzel ? `[${s.kuerzel}] ` : ""}${s.name}`)
    .join("\n");
  const companyListe = companyProducts
    .map((p) => `${p.id}: ${p.name}`)
    .join("\n");

  const prompt = `Du bist Versicherungs-Experte und ordnest Produkte sehr PRAEZISE zu.

AUFGABE: Fuer jedes Gesellschafts-Produkt pruefe, ob es eine SEMANTISCH IDENTISCHE Lead-Sparte gibt.

GESELLSCHAFTS-PRODUKTE (id: name):
${companyListe}

LEAD-SPARTEN (id: [kuerzel] name):
${leadListe}

WICHTIGE REGELN:
1. **Nur mappen bei echter Entsprechung**: Wenn kein semantisch aehnliches Lead-Produkt existiert, LASS ES WEG. Lieber kein Mapping als falsches Mapping.
2. **Ein Produkt = nur eine Versicherungsart**: "Tierlebensversicherung" hat NICHTS mit "Vermoegensschadenhaftpflicht" zu tun - solche Zuordnungen sind VERBOTEN.
3. **Wortstamm muss passen**: "Haftpflicht" passt nicht zu "Kasko", "Kranken" nicht zu "Leben", "Tier" nicht zu "Vermoegen".
4. **Confidence realistisch einschaetzen**:
   - 0.95-1.0: Exakte Entsprechung ("Betriebshaftpflichtversicherung" ↔ "BHV Betriebshaftpflichtversicherung")
   - 0.80-0.94: Starke semantische Uebereinstimmung ("Kfz-Haftpflichtversicherung" ↔ "KFZ Kraftfahrzeugversicherung")
   - 0.60-0.79: Moegliche Uebereinstimmung ("Private Krankenversicherung" ↔ "KVV Private Krankenvollversicherung")
   - Unter 0.60: NICHT MAPPEN - lass das Produkt weg!
5. **Wenn mehrere passen**, nimm die spezifischste Lead-Sparte.

Gib JSON zurueck:
{"mappings": [
  {"companyProductId": 1, "leadProductId": 42, "confidence": 0.95, "reasoning": "kurze Begruendung"},
  ...
]}

BEISPIELE fuer korrektes Verhalten:
- Allianz "Betriebshaftpflichtversicherung" → [BHV] Betriebshaftpflichtversicherung (1.0)
- Allianz "Tierlebensversicherung" → KEIN Mapping (keine passende Lead-Sparte existiert)
- Allianz "Bootskasko" → KEIN Mapping (Lead-Liste hat nur "YBV Yacht-/Bootsversicherung", aber das ist Haftpflicht-naeher)
- Allianz "Kfz-Haftpflichtversicherung" → [KFZ] Kraftfahrzeugversicherung (0.85)

Lieber WENIGER aber PRAEZISE Mappings als viele falsche!`;

  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0]?.message?.content || "{}";
}

// Verbindungstest
export async function testConnection(): Promise<{
  ok: boolean;
  model: string;
  backend: string;
  error?: string;
}> {
  const backend = getSetting("ai.backend") || "anthropic";
  const model = getSetting("ai.model") || "default";
  try {
    const response = await chat([
      { role: "user", content: "Antworte mit genau einem Wort: OK" },
    ]);
    return {
      ok: response.content.toUpperCase().includes("OK"),
      model,
      backend,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, model, backend, error: message };
  }
}
