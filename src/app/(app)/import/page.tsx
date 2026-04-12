"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, ArrowRight, RotateCcw, Loader2, AlertTriangle, Check, X, Trash2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SpeechInput } from "@/components/ui/speech-input";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const LEAD_FIELDS = [
  { key: "", label: "\u2014 Nicht importieren \u2014" },
  { key: "name", label: "Firma / Name *" },
  { key: "ansprechpartner", label: "Ansprechpartner" },
  { key: "email", label: "E-Mail" },
  { key: "telefon", label: "Telefon" },
  { key: "website", label: "Website" },
  { key: "gewerbeart", label: "Gewerbeart" },
  { key: "branche", label: "Branche" },
  { key: "unternehmensgroesse", label: "Unternehmensgroesse" },
  { key: "umsatzklasse", label: "Umsatzklasse" },
  { key: "termin", label: "Termin" },
  { key: "eingangsdatum", label: "Eingangsdatum" },
  { key: "terminKosten", label: "Termin-Kosten (\u20ac)" },
  { key: "umsatz", label: "Umsatz (\u20ac)" },
  { key: "notizen", label: "Notizen" },
];

// Alle editierbaren Lead-Felder fuer PDF-Preview
const PDF_LEAD_FIELDS = [
  { key: "name", label: "Firma / Name *" },
  { key: "ansprechpartner", label: "Ansprechpartner" },
  { key: "email", label: "E-Mail" },
  { key: "telefon", label: "Telefon" },
  { key: "website", label: "Website" },
  { key: "strasse", label: "Strasse" },
  { key: "plz", label: "PLZ" },
  { key: "ort", label: "Ort" },
  { key: "produkt", label: "Produkt / Sparte" },
  { key: "leadTyp", label: "Lead-Typ (Gewerbe/Privat)" },
  { key: "branche", label: "Branche" },
  { key: "unternehmensgroesse", label: "Unternehmensgroesse" },
  { key: "umsatzklasse", label: "Umsatzklasse" },
  { key: "gewerbeart", label: "Gewerbeart" },
  { key: "naechsterSchritt", label: "Naechster Schritt" },
  { key: "notizen", label: "Notizen", multiline: true },
] as const;

// Auto-Mapping: versuche Spaltenname auf Lead-Feld zu matchen
function autoMap(header: string): string {
  const h = header.toLowerCase().trim();
  const map: Record<string, string> = {
    name: "name", firma: "name", unternehmen: "name", company: "name",
    ansprechpartner: "ansprechpartner", kontakt: "ansprechpartner", contact: "ansprechpartner",
    email: "email", "e-mail": "email", mail: "email",
    telefon: "telefon", phone: "telefon", tel: "telefon",
    website: "website", web: "website", url: "website",
    gewerbeart: "gewerbeart",
    branche: "branche", industry: "branche",
    termin: "termin", appointment: "termin", datum: "termin",
    eingangsdatum: "eingangsdatum",
    kosten: "terminKosten", "termin-kosten": "terminKosten", terminkosten: "terminKosten",
    umsatz: "umsatz", revenue: "umsatz",
    notizen: "notizen", notes: "notizen", notiz: "notizen",
  };
  return map[h] || "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Step = "upload" | "mapping" | "preview" | "result";

interface ImportResult {
  imported: number;
  failed: number;
  total: number;
  details: { row: number; success: boolean; error?: string; name?: string }[];
}

type ImportMode = "csv" | "pdf";

interface PdfLead {
  name?: string;
  confidence?: number;
  _filename?: string;
  _saved?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

interface PdfFileResult {
  filename: string;
  extracted: PdfLead[];
  confidence: number;
  rawText: string;
  error?: string;
}

interface LeadProvider {
  id: number;
  name: string;
}

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ImportMode>("csv");
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // PDF-spezifisch
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pdfLeads, setPdfLeads] = useState<PdfLead[]>([]);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Provider
  const [providers, setProviders] = useState<LeadProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");

  // WhatsApp nach Import
  const [whatsappPrompt, setWhatsappPrompt] = useState<{ leadName: string; leadId: number; phone: string } | null>(null);
  const [whatsappSending, setWhatsappSending] = useState(false);

  // Provider laden
  useEffect(() => {
    fetch("/api/lead-providers/active")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {});
  }, []);

  function parseFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    setFileName(file.name);

    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (res) => {
          const data = res.data as string[][];
          if (data.length < 2) {
            toast.error("Datei enthaelt keine Daten");
            return;
          }
          setHeaders(data[0]);
          setRows(data.slice(1));
          // Auto-Mapping
          const autoMapping: Record<number, string> = {};
          data[0].forEach((h, i) => {
            const mapped = autoMap(h);
            if (mapped) autoMapping[i] = mapped;
          });
          setMapping(autoMapping);
          setStep("mapping");
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
        if (data.length < 2) {
          toast.error("Datei enthaelt keine Daten");
          return;
        }
        setHeaders(data[0].map(String));
        setRows(data.slice(1).map((r) => r.map(String)));
        // Auto-Mapping
        const autoMapping: Record<number, string> = {};
        data[0].forEach((h, i) => {
          const mapped = autoMap(String(h));
          if (mapped) autoMapping[i] = mapped;
        });
        setMapping(autoMapping);
        setStep("mapping");
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Nur CSV und Excel (XLSX) Dateien werden unterstuetzt");
    }
  }

  function getMappedLeads() {
    return rows.map((row) => {
      const lead: Record<string, string | number> = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field && row[Number(colIdx)]) {
          const val = row[Number(colIdx)].trim();
          if (field === "terminKosten" || field === "umsatz") {
            lead[field] = parseFloat(val.replace(",", ".")) || 0;
          } else {
            lead[field] = val;
          }
        }
      });
      return lead;
    });
  }

  const hasNameMapping = Object.values(mapping).includes("name");

  async function handleImport() {
    setImporting(true);
    const leads = getMappedLeads().filter((l) => l.name);
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      setResult(data);
      setStep("result");
      if (data.imported > 0) {
        toast.success(`${data.imported} Leads importiert`);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} Leads fehlgeschlagen`);
      }
    } catch {
      toast.error("Import fehlgeschlagen");
    }
    setImporting(false);
  }

  // Drag & Drop Handler fuer PDF
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.toLowerCase().endsWith(".pdf")
    );
    if (droppedFiles.length === 0) {
      toast.error("Bitte nur PDF-Dateien ablegen");
      return;
    }
    if (droppedFiles.length > 10) {
      toast.error("Maximal 10 Dateien gleichzeitig");
      return;
    }
    setPdfFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const newFiles = droppedFiles.filter((f) => !names.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  function handlePdfFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []).filter(
      (f) => f.name.toLowerCase().endsWith(".pdf")
    );
    if (selected.length === 0) return;
    setPdfFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const newFiles = selected.filter((f) => !names.has(f.name));
      return [...prev, ...newFiles];
    });
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  function removePdfFile(index: number) {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePdfExtract() {
    if (pdfFiles.length === 0) return;
    setPdfExtracting(true);

    try {
      const formData = new FormData();
      pdfFiles.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/leads/import/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "PDF-Analyse fehlgeschlagen");
        setPdfExtracting(false);
        return;
      }

      // Leads aus allen PDFs flach zusammenfuehren
      const allLeads: PdfLead[] = [];
      let totalLeadCount = 0;
      let errorCount = 0;

      for (const fileResult of data.leads as PdfFileResult[]) {
        if (fileResult.error) {
          errorCount++;
          toast.error(`${fileResult.filename}: ${fileResult.error}`);
          continue;
        }
        for (const lead of fileResult.extracted) {
          allLeads.push({ ...lead, _filename: fileResult.filename });
          totalLeadCount++;
        }
      }

      setPdfLeads(allLeads);
      setFileName(pdfFiles.length === 1 ? pdfFiles[0].name : `${pdfFiles.length} PDFs`);
      setStep("preview");

      if (totalLeadCount > 0) {
        toast.success(`${totalLeadCount} Lead(s) aus ${pdfFiles.length - errorCount} PDF(s) erkannt`);
      }
      if (totalLeadCount === 0 && errorCount === 0) {
        toast.warning("Keine Leads in den PDFs erkannt");
      }
    } catch {
      toast.error("PDF-Upload fehlgeschlagen");
    }
    setPdfExtracting(false);
  }

  async function handlePdfSaveSingle(index: number) {
    const lead = pdfLeads[index];
    if (!lead.name) {
      toast.error("Firmenname ist Pflicht");
      return;
    }
    setImporting(true);
    try {
      // Provider-ID mitsenden falls ausgewaehlt
      const leadData = { ...lead };
      delete leadData._filename;
      delete leadData._saved;
      delete leadData.confidence;
      if (selectedProvider) leadData.providerId = Number(selectedProvider);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: [leadData] }),
      });
      const data = await res.json();
      if (data.imported > 0) {
        toast.success(`"${lead.name}" gespeichert`);
        setPdfLeads((prev) => prev.map((l, i) => i === index ? { ...l, _saved: true } : l));
        // WhatsApp anbieten wenn Telefonnummer vorhanden
        const phone = typeof lead.telefon === "string" ? lead.telefon.trim() : "";
        const savedLeadId = data.details?.[0]?.id;
        if (phone && savedLeadId) {
          setWhatsappPrompt({ leadName: lead.name, leadId: savedLeadId, phone });
        }
      } else {
        toast.error(`Fehler beim Speichern von "${lead.name}"`);
      }
    } catch {
      toast.error("Speichern fehlgeschlagen");
    }
    setImporting(false);
  }

  async function handlePdfImportAll() {
    setImporting(true);
    const validLeads = pdfLeads
      .filter((l) => l.name && !l._saved)
      .map((l) => {
        const leadData = { ...l };
        delete leadData._filename;
        delete leadData._saved;
        delete leadData.confidence;
        if (selectedProvider) leadData.providerId = Number(selectedProvider);
        return leadData;
      });

    if (validLeads.length === 0) {
      toast.warning("Keine ungespeicherten Leads vorhanden");
      setImporting(false);
      return;
    }

    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: validLeads }),
      });
      const data = await res.json();
      setResult(data);
      setStep("result");
      if (data.imported > 0) toast.success(`${data.imported} Leads importiert`);
      if (data.failed > 0) toast.error(`${data.failed} fehlgeschlagen`);
    } catch {
      toast.error("Import fehlgeschlagen");
    }
    setImporting(false);
  }

  function updatePdfLead(index: number, field: string, value: string) {
    setPdfLeads((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function removePdfLead(index: number) {
    setPdfLeads((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setPdfLeads([]);
    setPdfFiles([]);
    setSelectedProvider("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  // Confidence Badge Farbe
  function confidenceBadge(confidence: number | undefined) {
    const c = typeof confidence === "number" ? confidence : 0.5;
    if (c >= 0.8) return <Badge variant="default" className="bg-emerald-500 text-white text-xs">{Math.round(c * 100)}%</Badge>;
    if (c >= 0.5) return <Badge variant="secondary" className="border-amber-400 bg-amber-50 text-amber-700 text-xs">{Math.round(c * 100)}%</Badge>;
    return <Badge variant="destructive" className="text-xs">{Math.round(c * 100)}%</Badge>;
  }

  // Ist ein Feld unsicher? (Confidence < 0.5 und Feld leer/kurz)
  function isFieldUncertain(lead: PdfLead, fieldKey: string): boolean {
    const confidence = typeof lead.confidence === "number" ? lead.confidence : 0.5;
    if (confidence >= 0.5) return false;
    const val = String(lead[fieldKey] || "");
    return val.length === 0 || val.length < 2;
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Lead-Import" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* Mode Tabs */}
        <div className="flex gap-2">
          <Button
            variant={mode === "csv" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("csv"); reset(); }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV / Excel
          </Button>
          <Button
            variant={mode === "pdf" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("pdf"); reset(); }}
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF (KI-Import)
          </Button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 text-sm">
          {(mode === "csv" ? ["Upload", "Zuordnung", "Vorschau", "Ergebnis"] : ["Upload", "Vorschau", "Ergebnis"]).map((label, i) => {
            const csvSteps: Step[] = ["upload", "mapping", "preview", "result"];
            const pdfSteps: Step[] = ["upload", "preview", "result"];
            const steps = mode === "csv" ? csvSteps : pdfSteps;
            const isActive = steps.indexOf(step) >= i;
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                <Badge variant={isActive ? "default" : "secondary"}>{label}</Badge>
              </div>
            );
          })}
        </div>

        {/* CSV Upload */}
        {step === "upload" && mode === "csv" && (
          <Card>
            <CardHeader>
              <CardTitle>CSV oder Excel hochladen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Die erste Zeile wird als Spaltenueberschrift verwendet
              </p>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">Datei hier ablegen oder klicken</p>
                <p className="text-xs text-muted-foreground mt-1">CSV, XLSX unterstuetzt</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) parseFile(file);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* PDF Upload — Multi-File mit Drag & Drop */}
        {step === "upload" && mode === "pdf" && (
          <Card>
            <CardHeader>
              <CardTitle>PDFs mit KI analysieren</CardTitle>
              <p className="text-sm text-muted-foreground">
                Claude liest die PDFs und extrahiert automatisch Lead-Daten. Du kannst vor dem Import alles pruefen und korrigieren.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => !pdfExtracting && pdfInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">PDFs hierher ziehen oder klicken</p>
                <p className="text-xs text-muted-foreground mt-1">Max. 10 MB pro Datei, mehrere PDFs moeglich</p>
              </div>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handlePdfFileSelect}
              />

              {/* Dateiliste */}
              {pdfFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{pdfFiles.length} Datei(en) ausgewaehlt:</p>
                  {pdfFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{formatFileSize(f.size)}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePdfFile(i)} className="flex-shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* KI-Analyse starten */}
                  <Button
                    onClick={handlePdfExtract}
                    disabled={pdfExtracting || pdfFiles.length === 0}
                    className="w-full mt-2"
                  >
                    {pdfExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        KI analysiert {pdfFiles.length} PDF{pdfFiles.length > 1 ? "s" : ""}...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        KI-Analyse starten
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PDF Preview — editierbare Karten mit Confidence */}
        {step === "preview" && mode === "pdf" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Erkannte Leads pruefen</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {fileName} —{pdfLeads.length} Lead(s) erkannt. Pruefe und korrigiere die Daten vor dem Import.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Gelbe Felder = KI unsicher</span>
                </div>
              </div>

              {/* Provider Auswahl (optional) */}
              {providers.length > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <Label className="text-sm whitespace-nowrap">Lead-Provider:</Label>
                  <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v || "")}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Kein Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Provider</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {pdfLeads.map((lead, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 space-y-3 transition-colors ${
                    lead._saved ? "bg-emerald-50 border-emerald-200 opacity-75" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {lead._saved && <Check className="h-4 w-4 text-emerald-600 inline mr-1" />}
                        Lead {i + 1}: {lead.name || "\u2014"}
                      </p>
                      {confidenceBadge(lead.confidence)}
                      {lead._filename && (
                        <span className="text-xs text-muted-foreground">({lead._filename})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!lead._saved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePdfSaveSingle(i)}
                          disabled={importing || !lead.name}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Speichern
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removePdfLead(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!lead._saved && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {PDF_LEAD_FIELDS.map((field) => (
                        <div key={field.key} className={`space-y-1 ${"multiline" in field && field.multiline ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">{field.label}</Label>
                            {"multiline" in field && field.multiline && (
                              <SpeechInput
                                className="h-5 w-5"
                                onTranscript={(t) => {
                                  const cur = String(lead[field.key] || "");
                                  updatePdfLead(i, field.key, cur ? cur + " " + t : t);
                                }}
                              />
                            )}
                          </div>
                          {"multiline" in field && field.multiline ? (
                            <textarea
                              value={String(lead[field.key] || "")}
                              onChange={(e) => updatePdfLead(i, field.key, e.target.value)}
                              rows={2}
                              className={`w-full rounded-md border px-3 py-1.5 text-sm resize-y ${
                                isFieldUncertain(lead, field.key) ? "border-amber-400 bg-amber-50" : "border-input bg-background"
                              }`}
                            />
                          ) : (
                            <Input
                              value={String(lead[field.key] || "")}
                              onChange={(e) => updatePdfLead(i, field.key, e.target.value)}
                              className={`h-8 text-sm ${
                                isFieldUncertain(lead, field.key) ? "border-amber-400 bg-amber-50" : ""
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {pdfLeads.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Keine Leads erkannt</p>
              )}
              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={reset}>Abbrechen</Button>
                <Button
                  onClick={handlePdfImportAll}
                  disabled={importing || pdfLeads.filter(l => l.name && !l._saved).length === 0}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing
                    ? "Importiere..."
                    : `${pdfLeads.filter(l => l.name && !l._saved).length} Leads importieren`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <Card>
            <CardHeader>
              <CardTitle>Spalten zuordnen</CardTitle>
              <p className="text-sm text-muted-foreground">
                {fileName} — {rows.length} Zeilen erkannt. Ordne die Spalten den Lead-Feldern zu.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="w-48 text-sm font-medium truncate" title={header}>
                      {header}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={mapping[i] || ""}
                      onValueChange={(v) => { if (v) setMapping((prev) => ({ ...prev, [i]: v })); }}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Zuordnen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key || "none"}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rows[0]?.[i] && (
                      <span className="text-xs text-muted-foreground truncate max-w-32">
                        z.B. &quot;{rows[0][i]}&quot;
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-6">
                <Button variant="outline" onClick={reset}>Abbrechen</Button>
                <Button
                  onClick={() => setStep("preview")}
                  disabled={!hasNameMapping}
                >
                  {!hasNameMapping && <span className="text-xs mr-2">⚠ &quot;Firma / Name&quot; muss zugeordnet sein</span>}
                  Weiter zur Vorschau
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <Card>
            <CardHeader>
              <CardTitle>Vorschau</CardTitle>
              <p className="text-sm text-muted-foreground">
                {rows.filter((r) => {
                  const nameIdx = Object.entries(mapping).find(([, v]) => v === "name")?.[0];
                  return nameIdx !== undefined && r[Number(nameIdx)]?.trim();
                }).length} von {rows.length} Zeilen werden importiert (Name vorhanden)
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {Object.entries(mapping)
                        .filter(([, v]) => v && v !== "none")
                        .map(([colIdx, field]) => (
                          <TableHead key={colIdx}>
                            {LEAD_FIELDS.find((f) => f.key === field)?.label || field}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {Object.entries(mapping)
                          .filter(([, v]) => v && v !== "none")
                          .map(([colIdx]) => (
                            <TableCell key={colIdx} className="max-w-48 truncate">
                              {row[Number(colIdx)] || "—"}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  ... und {rows.length - 5} weitere Zeilen
                </p>
              )}
              <div className="flex items-center justify-between mt-6">
                <Button variant="outline" onClick={() => setStep("mapping")}>Zurück</Button>
                <Button onClick={handleImport} disabled={importing}>
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importiere..." : `${rows.length} Leads importieren`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Result */}
        {step === "result" && result && (
          <Card>
            <CardHeader>
              <CardTitle>Import abgeschlossen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-lg font-bold">{result.imported}</span>
                  <span className="text-sm text-muted-foreground">importiert</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-lg font-bold">{result.failed}</span>
                    <span className="text-sm text-muted-foreground">fehlgeschlagen</span>
                  </div>
                )}
              </div>
              {result.failed > 0 && (
                <div className="mb-6 space-y-1">
                  <p className="text-sm font-medium text-red-600">Fehler:</p>
                  {result.details
                    .filter((d) => !d.success)
                    .map((d) => (
                      <p key={d.row} className="text-xs text-muted-foreground">
                        Zeile {d.row}: {d.error}
                      </p>
                    ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Weiteren Import
                </Button>
                <Button onClick={() => router.push("/pipeline")}>
                  Zur Pipeline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* WhatsApp-Prompt nach Import */}
      {whatsappPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setWhatsappPrompt(null)}>
          <div className="bg-background rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Per WhatsApp anschreiben?</p>
                <p className="text-xs text-muted-foreground">{whatsappPrompt.leadName} ({whatsappPrompt.phone})</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Soll dem Lead die Begrüßungs-Vorlage per WhatsApp über Superchat gesendet werden?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setWhatsappPrompt(null)} disabled={whatsappSending}>
                Nein, danke
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={whatsappSending}
                onClick={async () => {
                  setWhatsappSending(true);
                  try {
                    const res = await fetch("/api/leads/whatsapp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ leadId: whatsappPrompt.leadId }),
                    });
                    if (res.ok) {
                      toast.success(`WhatsApp an ${whatsappPrompt.leadName} gesendet`);
                    } else {
                      const data = await res.json().catch(() => ({}));
                      toast.error(data.error || "WhatsApp-Versand fehlgeschlagen");
                    }
                  } catch {
                    toast.error("WhatsApp-Versand fehlgeschlagen");
                  }
                  setWhatsappSending(false);
                  setWhatsappPrompt(null);
                }}
              >
                {whatsappSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageCircle className="h-4 w-4 mr-1" />}
                Ja, anschreiben
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
