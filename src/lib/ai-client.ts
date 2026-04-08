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
          "Extrahiere Lead-Daten als JSON. Nutze EXAKT diese Felder:\n" +
          "- name, ansprechpartner, email, telefon, website\n" +
          "- strasse, plz, ort\n" +
          "- gewerbeart (hauptberuflich/nebenberuflich)\n" +
          "- branche (Bau, Handwerk, Dienstleistung, Produktion, IT, Gesundheit, Logistik, Handel, Gastronomie, Immobilien, Sonstiges)\n" +
          "- unternehmensgroesse (1–9, 10–49, 50–199, 200–999, 1000+)\n" +
          "- umsatzklasse (<1 Mio, 1–5 Mio, 5–20 Mio, 20–100 Mio, >100 Mio)\n" +
          "- notizen, naechsterSchritt\n" +
          "- termin (Datum und Uhrzeit im Format TT.MM.JJJJ HH:MM, oder null falls kein Termin genannt)\n" +
          "- produkt (eines von: Beratung, Betriebshaftpflicht, Firmenversicherung, Flottenversicherung, Haftpflichtversicherung, Rechtsschutzversicherung, Vermögensschadenhaftpflicht, Sonstiges)\n\n" +
          "Felder die nicht gefunden werden auf \"\" setzen.\n\n" +
          "E-Mail-Inhalt: " + emailText,
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
