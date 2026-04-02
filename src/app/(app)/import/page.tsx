"use client";

import { useState, useRef } from "react";
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
import { Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, ArrowRight, RotateCcw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const LEAD_FIELDS = [
  { key: "", label: "— Nicht importieren —" },
  { key: "name", label: "Firma / Name *" },
  { key: "ansprechpartner", label: "Ansprechpartner" },
  { key: "email", label: "E-Mail" },
  { key: "telefon", label: "Telefon" },
  { key: "website", label: "Website" },
  { key: "gewerbeart", label: "Gewerbeart" },
  { key: "branche", label: "Branche" },
  { key: "unternehmensgroesse", label: "Unternehmensgröße" },
  { key: "umsatzklasse", label: "Umsatzklasse" },
  { key: "termin", label: "Termin" },
  { key: "eingangsdatum", label: "Eingangsdatum" },
  { key: "terminKosten", label: "Termin-Kosten (€)" },
  { key: "umsatz", label: "Umsatz (€)" },
  { key: "notizen", label: "Notizen" },
];

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
  [key: string]: string | number | null | undefined;
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
  const [pdfLeads, setPdfLeads] = useState<PdfLead[]>([]);
  const [pdfExtracting, setPdfExtracting] = useState(false);

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
            toast.error("Datei enthält keine Daten");
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
          toast.error("Datei enthält keine Daten");
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
      toast.error("Nur CSV und Excel (XLSX) Dateien werden unterstützt");
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

  async function handlePdfUpload(file: File) {
    setPdfExtracting(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/leads/import/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setPdfExtracting(false); return; }
      setPdfLeads(data.leads);
      setStep("preview");
      toast.success(`${data.leads.length} Lead(s) aus PDF erkannt`);
    } catch { toast.error("PDF-Upload fehlgeschlagen"); }
    setPdfExtracting(false);
  }

  async function handlePdfImport() {
    setImporting(true);
    const validLeads = pdfLeads.filter((l) => l.name);
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
    } catch { toast.error("Import fehlgeschlagen"); }
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (pdfInputRef.current) pdfInputRef.current.value = "";
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
                Die erste Zeile wird als Spaltenüberschrift verwendet
              </p>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">Datei hier ablegen oder klicken</p>
                <p className="text-xs text-muted-foreground mt-1">CSV, XLSX unterstützt</p>
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

        {/* PDF Upload */}
        {step === "upload" && mode === "pdf" && (
          <Card>
            <CardHeader>
              <CardTitle>PDF mit KI analysieren</CardTitle>
              <p className="text-sm text-muted-foreground">
                Claude liest das PDF und extrahiert automatisch Lead-Daten. Du kannst vor dem Import alles prüfen und korrigieren.
              </p>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => !pdfExtracting && pdfInputRef.current?.click()}
              >
                {pdfExtracting ? (
                  <>
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                    <p className="text-sm font-medium">KI analysiert PDF...</p>
                    <p className="text-xs text-muted-foreground mt-1">Das kann einige Sekunden dauern</p>
                  </>
                ) : (
                  <>
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm font-medium">PDF hier ablegen oder klicken</p>
                    <p className="text-xs text-muted-foreground mt-1">Max. 10 MB, Lead-Daten werden per KI extrahiert</p>
                  </>
                )}
              </div>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* PDF Preview */}
        {step === "preview" && mode === "pdf" && (
          <Card>
            <CardHeader>
              <CardTitle>Erkannte Leads prüfen</CardTitle>
              <p className="text-sm text-muted-foreground">
                {fileName} — {pdfLeads.length} Lead(s) erkannt. Prüfe und korrigiere die Daten vor dem Import.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {pdfLeads.map((lead, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Lead {i + 1}: {lead.name || "—"}</p>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removePdfLead(i)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { key: "name", label: "Firma *" },
                      { key: "ansprechpartner", label: "Ansprechpartner" },
                      { key: "email", label: "E-Mail" },
                      { key: "telefon", label: "Telefon" },
                      { key: "strasse", label: "Straße" },
                      { key: "plz", label: "PLZ" },
                      { key: "ort", label: "Ort" },
                      { key: "branche", label: "Branche" },
                      { key: "notizen", label: "Notizen" },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          value={String(lead[key] || "")}
                          onChange={(e) => updatePdfLead(i, key, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {pdfLeads.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Keine Leads erkannt</p>
              )}
              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={reset}>Abbrechen</Button>
                <Button onClick={handlePdfImport} disabled={importing || pdfLeads.filter(l => l.name).length === 0}>
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importiere..." : `${pdfLeads.filter(l => l.name).length} Leads importieren`}
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
    </div>
  );
}
