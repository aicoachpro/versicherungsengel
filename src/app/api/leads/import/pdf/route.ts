import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;
const RAW_TEXT_PREVIEW_LENGTH = 500;

const EXTRACTION_PROMPT = `Analysiere den PDF-Inhalt und extrahiere alle Lead-Daten.
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
- termin (Datum im Format YYYY-MM-DDTHH:MM, oder null)
- terminKosten (Zahl, default 320)
- notizen (zusaetzliche relevante Infos aus dem PDF)
- confidence (0-1, wie sicher du bei der Extraktion bist. Unter 0.5 = sehr unsicher)

Setze leere Felder auf "". Antworte NUR mit dem JSON-Array, kein anderer Text.
Falls keine Lead-Daten erkennbar sind, antworte mit [].`;

interface ExtractedLead {
  name?: string;
  confidence?: number;
  [key: string]: string | number | null | undefined;
}

interface PdfResult {
  filename: string;
  extracted: ExtractedLead[];
  confidence: number;
  rawText: string;
  error?: string;
}

function parseJsonFromResponse(text: string): ExtractedLead[] {
  let jsonStr = text.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) {
    throw new Error("KI-Antwort war kein gueltiges Array");
  }
  return parsed;
}

async function extractFromPdf(
  client: Anthropic,
  file: File,
): Promise<PdfResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

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
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const leads = parseJsonFromResponse(text);

  // Durchschnittliche Confidence berechnen
  const avgConfidence =
    leads.length > 0
      ? leads.reduce((sum, l) => sum + (typeof l.confidence === "number" ? l.confidence : 0.5), 0) / leads.length
      : 0;

  return {
    filename: file.name,
    extracted: leads,
    confidence: Math.round(avgConfidence * 100) / 100,
    rawText: text.substring(0, RAW_TEXT_PREVIEW_LENGTH),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 500 });

  const formData = await req.formData();

  // Mehrere Dateien unterstuetzen: "files" (mehrere) oder "file" (einzeln, Rueckwaertskompatibel)
  const files: File[] = [];
  const multiFiles = formData.getAll("files");
  if (multiFiles.length > 0) {
    for (const f of multiFiles) {
      if (f instanceof File) files.push(f);
    }
  } else {
    const singleFile = formData.get("file") as File | null;
    if (singleFile) files.push(singleFile);
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Bitte mindestens eine PDF-Datei hochladen" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximal ${MAX_FILES} Dateien gleichzeitig` }, { status: 400 });
  }

  // Validierung
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: `"${file.name}" ist keine PDF-Datei` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `"${file.name}" ist zu gross (max 10 MB)` }, { status: 400 });
    }
  }

  try {
    const client = new Anthropic({ apiKey });

    const results: PdfResult[] = [];
    for (const file of files) {
      try {
        const result = await extractFromPdf(client, file);
        results.push(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        results.push({
          filename: file.name,
          extracted: [],
          confidence: 0,
          rawText: "",
          error: message,
        });
      }
    }

    return NextResponse.json({ leads: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `PDF-Verarbeitung fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
