import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 500 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Bitte eine PDF-Datei hochladen" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Datei zu groß (max 10 MB)" }, { status: 400 });
  }

  try {
    // PDF als Base64 für Claude Vision
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `Extrahiere alle Lead-Daten aus diesem PDF-Dokument als JSON-Array.

Jeder Lead soll diese Felder haben (wenn vorhanden):
- name (Firmenname, PFLICHT)
- ansprechpartner
- email
- telefon
- website
- strasse
- plz
- ort
- gewerbeart (hauptberuflich/nebenberuflich)
- branche (Bau, Handwerk, Dienstleistung, Produktion, IT, Gesundheit, Logistik, Handel, Gastronomie, Immobilien, Sonstiges)
- unternehmensgroesse (1–9, 10–49, 50–199, 200–999, 1000+)
- umsatzklasse (<1 Mio, 1–5 Mio, 5–20 Mio, 20–100 Mio, >100 Mio)
- termin (Datum im Format YYYY-MM-DDTHH:MM, oder null)
- terminKosten (Zahl, default 320)
- notizen

Antworte NUR mit dem JSON-Array, kein anderer Text. Bei mehreren Leads ein Array, bei einem Lead auch ein Array mit einem Element.
Falls keine Lead-Daten erkennbar sind, antworte mit [].`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // JSON aus Antwort extrahieren (mit/ohne Code-Block)
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    const leads = JSON.parse(jsonStr);

    if (!Array.isArray(leads)) {
      return NextResponse.json({ error: "KI-Antwort war kein gültiges Array", raw: text }, { status: 422 });
    }

    return NextResponse.json({ leads, filename: file.name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `PDF-Verarbeitung fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
