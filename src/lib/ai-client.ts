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
  });

  return { content: response.choices[0]?.message?.content || "" };
}

// Convenience: Lead-Extraktion aus Freitext
export async function extractLeadFromText(text: string): Promise<string> {
  return (
    await chat([
      {
        role: "system",
        content:
          'Du bist ein Datenextraktions-Assistent für Versicherungsvermittler. Extrahiere alle relevanten Lead-Daten aus dem folgenden Text und gib sie als JSON zurück mit den Feldern: name, ansprechpartner, email, telefon, website, branche, strasse, plz, ort, unternehmensgroesse, notizen. Wenn ein Feld nicht gefunden wird, setze es auf "".',
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
        content:
          'Du bist ein Datenextraktions-Assistent für Versicherungsvermittler. Analysiere den folgenden PDF-Inhalt und extrahiere alle Lead-Daten. Gib sie als JSON zurück mit den Feldern: name, ansprechpartner, email, telefon, website, branche, strasse, plz, ort, unternehmensgroesse, umsatzklasse, gewerbeart, notizen. Wenn ein Feld nicht gefunden wird, setze es auf "".',
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
