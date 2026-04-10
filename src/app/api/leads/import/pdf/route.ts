import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractLeadFromPDF } from "@/lib/ai-client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;
const RAW_TEXT_PREVIEW_LENGTH = 500;

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

  // Falls die Antwort ein Objekt mit "leads" oder Array ist
  const parsed = JSON.parse(jsonStr);
  if (Array.isArray(parsed)) return parsed;
  if (parsed.leads && Array.isArray(parsed.leads)) return parsed.leads;
  if (parsed.name) return [parsed]; // Einzelner Lead
  throw new Error("KI-Antwort war kein gueltiges Lead-Array");
}

async function extractFromPdf(file: File): Promise<PdfResult> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // PDF-Text extrahieren mit unpdf
  let pdfText = "";
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(buffer);
    pdfText = Array.isArray(result.text) ? result.text.join("\n") : (result.text || "");
  } catch (err) {
    // Fallback: Rohtext aus PDF-Stream
    try {
      const str = buffer.toString("latin1");
      const btEtPattern = /BT\s([\s\S]*?)ET/g;
      const textParts: string[] = [];
      let match;
      while ((match = btEtPattern.exec(str)) !== null) {
        const tjPattern = /\(([^)]*)\)/g;
        let tm;
        while ((tm = tjPattern.exec(match[1])) !== null) {
          const decoded = tm[1].replace(/\\[nrt]/g, " ").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
          if (decoded.trim()) textParts.push(decoded);
        }
      }
      pdfText = textParts.join(" ").replace(/\s+/g, " ").trim();
    } catch {
      // ignore
    }
    if (!pdfText) {
      return {
        filename: file.name,
        extracted: [],
        confidence: 0,
        rawText: "",
        error: `PDF konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (!pdfText.trim()) {
    return {
      filename: file.name,
      extracted: [],
      confidence: 0,
      rawText: "",
      error: "PDF enthaelt keinen lesbaren Text (evtl. gescanntes Bild)",
    };
  }

  // KI-Extraktion ueber das konfigurierte Backend (Mistral/Claude/LocalAI)
  const aiResponse = await extractLeadFromPDF(pdfText);
  const leads = parseJsonFromResponse(aiResponse);

  const avgConfidence =
    leads.length > 0
      ? leads.reduce((sum, l) => sum + (typeof l.confidence === "number" ? l.confidence : 0.5), 0) / leads.length
      : 0;

  return {
    filename: file.name,
    extracted: leads,
    confidence: Math.round(avgConfidence * 100) / 100,
    rawText: pdfText.substring(0, RAW_TEXT_PREVIEW_LENGTH),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();

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

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: `"${file.name}" ist keine PDF-Datei` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `"${file.name}" ist zu gross (max 10 MB)` }, { status: 400 });
    }
  }

  try {
    const results: PdfResult[] = [];
    for (const file of files) {
      try {
        const result = await extractFromPdf(file);
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
