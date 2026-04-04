"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Coins,
  Upload,
  Loader2,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

// --- Typen ---

interface ProvisionImport {
  id: number;
  filename: string;
  importedAt: string;
  rowCount: number;
  totalAmount: number;
  matchedCount: number;
  unmatchedCount: number;
}

interface Provision {
  id: number;
  importId: number;
  datum: string;
  versNehmer: string;
  versNr: string;
  datevKonto: string;
  buchungstext: string;
  provBasis: number;
  satz: number;
  betrag: number;
  leadId: number | null;
  leadName: string | null;
}

interface LeadSearchResult {
  id: number;
  name: string;
}

// --- Hilfsfunktionen ---

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

// --- Komponenten ---

function LeadAssignDropdown({
  provisionId,
  onAssigned,
}: {
  provisionId: number;
  onAssigned: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          setResults(await res.json());
        }
      } catch {
        // ignorieren
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function assignLead(leadId: number) {
    try {
      const res = await fetch(`/api/provisions/${provisionId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) {
        toast.success("Lead zugeordnet");
        setOpen(false);
        onAssigned();
      } else {
        toast.error("Zuordnung fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler bei der Zuordnung");
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-0.5 text-xs font-semibold cursor-pointer">
        <HelpCircle className="h-3 w-3 mr-1" />?
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <div className="space-y-2">
          <Input
            placeholder="Lead suchen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          {searching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Suche...
            </div>
          )}
          {results.length === 0 && query.length >= 2 && !searching && (
            <p className="text-xs text-muted-foreground px-2">Keine Leads gefunden</p>
          )}
          {results.map((lead) => (
            <DropdownMenuItem
              key={lead.id}
              onClick={() => assignLead(lead.id)}
              className="cursor-pointer"
            >
              <Link2 className="h-3 w-3 mr-2" />
              {lead.name}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Hauptseite ---

export default function ProvisionenPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<{
    rows: number;
    total: number;
    matched: number;
    unmatched: number;
  } | null>(null);

  // Import-History
  const [imports, setImports] = useState<ProvisionImport[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);

  // Provisionen
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const monthOptions = generateMonthOptions();

  // Debounce Suche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Import-History laden
  const fetchImports = useCallback(async () => {
    try {
      const res = await fetch("/api/provisions/imports");
      if (res.ok) {
        setImports(await res.json());
      }
    } catch {
      // ignorieren
    }
  }, []);

  // Provisionen laden
  const fetchProvisions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedImportId) params.set("importId", String(selectedImportId));
    if (monthFilter !== "all") params.set("month", monthFilter);
    if (statusFilter === "matched") params.set("matched", "true");
    if (statusFilter === "unmatched") params.set("matched", "false");
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

    try {
      const res = await fetch(`/api/provisions?${params}`);
      if (res.ok) {
        setProvisions(await res.json());
      }
    } catch {
      // ignorieren
    }
    setLoading(false);
  }, [selectedImportId, monthFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  useEffect(() => {
    fetchProvisions();
  }, [fetchProvisions]);

  // CSV Upload
  async function handleFileUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Bitte nur CSV-Dateien hochladen");
      return;
    }
    setUploading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/provisions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import fehlgeschlagen");
        setUploading(false);
        return;
      }
      setImportResult({
        rows: data.rows ?? 0,
        total: data.totalAmount ?? 0,
        matched: data.matched ?? 0,
        unmatched: data.unmatched ?? 0,
      });
      toast.success(`${data.rows ?? 0} Provisionen importiert`);
      fetchImports();
      fetchProvisions();
    } catch {
      toast.error("Upload fehlgeschlagen");
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  // Summe berechnen
  const totalBetrag = provisions.reduce((sum, p) => sum + p.betrag, 0);

  return (
    <>
      <Header title="Provisionen" />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Upload-Bereich */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              CSV-Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Importiere...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">CSV-Datei hierher ziehen oder klicken</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Provisions-Abrechnung als CSV
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />

            {/* Import-Ergebnis */}
            {importResult && (
              <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-medium">{importResult.rows} Zeilen</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Summe: <span className="font-medium text-foreground">{formatCurrency(importResult.total)}</span>
                </div>
                <Badge variant="default" className="bg-emerald-500">
                  {importResult.matched} Matched
                </Badge>
                <Badge variant="outline" className="border-amber-400 text-amber-700">
                  {importResult.unmatched} Unmatched
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Import-History */}
        {imports.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Bisherige Importe
            </h2>
            <div className="flex flex-wrap gap-3">
              {imports.map((imp) => (
                <button
                  key={imp.id}
                  onClick={() =>
                    setSelectedImportId(selectedImportId === imp.id ? null : imp.id)
                  }
                  className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent ${
                    selectedImportId === imp.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : ""
                  }`}
                >
                  <p className="font-medium truncate max-w-[200px]">{imp.filename}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(imp.importedAt)} — {imp.rowCount} Zeilen — {formatCurrency(imp.totalAmount)}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="default" className="bg-emerald-500 text-xs">
                      {imp.matchedCount}
                    </Badge>
                    <Badge variant="outline" className="border-amber-400 text-amber-700 text-xs">
                      {imp.unmatchedCount}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Provisions-Tabelle */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              Provisionen
              <Badge variant="secondary">{provisions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Name, Vers.Nr. ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={monthFilter}
                  onValueChange={(v) => {
                    if (v) setMonthFilter(v);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Alle Monate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Monate</SelectItem>
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    if (v) setStatusFilter(v);
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="unmatched">Unmatched</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
                <Loader2 className="h-5 w-5 animate-spin" />
                Lade Provisionen...
              </div>
            ) : provisions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                <Coins className="h-8 w-8 opacity-50" />
                <p>Keine Provisionen vorhanden</p>
                {(debouncedSearch || monthFilter !== "all" || statusFilter !== "all" || selectedImportId) && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setDebouncedSearch("");
                      setMonthFilter("all");
                      setStatusFilter("all");
                      setSelectedImportId(null);
                    }}
                  >
                    Filter zuruecksetzen
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile: Karten */}
                <div className="md:hidden space-y-3">
                  {provisions.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{p.versNehmer}</span>
                        <span
                          className={`text-sm font-bold ${
                            p.betrag >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(p.betrag)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(p.datum)}</span>
                        <span>{p.versNr}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.buchungstext}</span>
                        <span>{p.datevKonto}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Basis: {formatCurrency(p.provBasis)} / Satz: {p.satz}%
                        </span>
                        {p.leadId ? (
                          <Badge
                            variant="default"
                            className="bg-emerald-500 cursor-pointer text-xs"
                            onClick={() => router.push(`/pipeline/${p.leadId}`)}
                          >
                            {p.leadName || `Lead #${p.leadId}`}
                          </Badge>
                        ) : (
                          <LeadAssignDropdown
                            provisionId={p.id}
                            onAssigned={fetchProvisions}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Mobile Summe */}
                  <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Gesamt</span>
                    <span
                      className={`text-sm font-bold ${
                        totalBetrag >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(totalBetrag)}
                    </span>
                  </div>
                </div>

                {/* Desktop: Tabelle */}
                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Vers. Nehmer</TableHead>
                        <TableHead>Vers. Nr.</TableHead>
                        <TableHead>DATEV-Konto</TableHead>
                        <TableHead>Buchungstext</TableHead>
                        <TableHead className="text-right">Prov.Basis</TableHead>
                        <TableHead className="text-right">Satz</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead>Lead</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provisions.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{formatDate(p.datum)}</TableCell>
                          <TableCell className="text-sm font-medium">{p.versNehmer}</TableCell>
                          <TableCell className="text-sm">{p.versNr}</TableCell>
                          <TableCell className="text-sm">{p.datevKonto}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {p.buchungstext}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {formatCurrency(p.provBasis)}
                          </TableCell>
                          <TableCell className="text-sm text-right">{p.satz}%</TableCell>
                          <TableCell
                            className={`text-sm text-right font-medium ${
                              p.betrag >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(p.betrag)}
                          </TableCell>
                          <TableCell>
                            {p.leadId ? (
                              <Badge
                                variant="default"
                                className="bg-emerald-500 cursor-pointer text-xs"
                                onClick={() => router.push(`/pipeline/${p.leadId}`)}
                              >
                                {p.leadName || `Lead #${p.leadId}`}
                              </Badge>
                            ) : (
                              <LeadAssignDropdown
                                provisionId={p.id}
                                onAssigned={fetchProvisions}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={7} className="text-sm font-semibold">
                          Gesamt
                        </TableCell>
                        <TableCell
                          className={`text-sm text-right font-bold ${
                            totalBetrag >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(totalBetrag)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
