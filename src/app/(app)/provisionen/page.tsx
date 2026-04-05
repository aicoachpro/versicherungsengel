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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Coins,
  Loader2,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Link2,
  Check,
  X,
  AlertTriangle,
  Trash2,
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
  skippedCount?: number;
}

interface Provision {
  id: number;
  importId: number;
  datum: string;
  versNehmer: string;
  versNr: string;
  kontoName: string | null;
  datevKonto: string;
  buchungstext: string;
  provBasis: number;
  satz: number;
  betrag: number;
  leadId: number | null;
  leadName: string | null;
  confirmed: boolean;
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
  if (!iso) return "\u2014";
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

// Lead-Badge (ohne Buttons — die kommen in die Aktion-Spalte)
function LeadBadge({
  provision,
  onNavigate,
}: {
  provision: Provision;
  onNavigate: (leadId: number) => void;
}) {
  if (!provision.leadId) return null;

  const isAbweichung = provision.kontoName?.startsWith("[ABWEICHUNG]");

  if (provision.confirmed) {
    return (
      <div className="flex items-center gap-1">
        <Badge
          variant="default"
          className="bg-emerald-500 cursor-pointer text-xs"
          onClick={() => onNavigate(provision.leadId!)}
        >
          {provision.leadName || `Lead #${provision.leadId}`}
        </Badge>
        {isAbweichung && (
          <Badge variant="outline" className="border-orange-400 text-orange-700 text-xs">
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            Abweichung
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Badge
        variant="outline"
        className="border-amber-400 bg-amber-50 text-amber-700 text-xs cursor-pointer"
        onClick={() => onNavigate(provision.leadId!)}
      >
        {provision.leadName || `Lead #${provision.leadId}`}
      </Badge>
      {isAbweichung && (
        <Badge variant="outline" className="border-orange-400 text-orange-700 text-xs">
          <AlertTriangle className="h-3 w-3 mr-0.5" />
        </Badge>
      )}
    </div>
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
    skipped: number;
  } | null>(null);

  // Import-History
  const [imports, setImports] = useState<ProvisionImport[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);

  // Provisionen
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Checkbox-State fuer Batch-Bestaetigung
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  // Filter
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const monthOptions = generateMonthOptions();

  // Unbestätigte Vorschläge zählen
  const unconfirmedCount = provisions.filter(
    (p) => p.leadId && !p.confirmed
  ).length;

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

  // Nach Laden: alle unbestaetigten Matches vorauswählen
  useEffect(() => {
    const unconfirmedIds = new Set(
      provisions
        .filter((p) => p.leadId && !p.confirmed)
        .map((p) => p.id)
    );
    setCheckedIds(unconfirmedIds);
  }, [provisions]);

  // Checkbox toggle
  function toggleChecked(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllChecked() {
    const unconfirmedWithLead = provisions.filter((p) => p.leadId && !p.confirmed);
    if (checkedIds.size === unconfirmedWithLead.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(unconfirmedWithLead.map((p) => p.id)));
    }
  }

  // Einzelne Provision ablehnen (Lead-Zuordnung entfernen)
  async function handleReject(provisionId: number) {
    try {
      const res = await fetch(`/api/provisions/${provisionId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: null }),
      });
      if (res.ok) {
        toast.success("Vorschlag abgelehnt");
        fetchProvisions();
      } else {
        toast.error("Ablehnung fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler bei der Ablehnung");
    }
  }

  // Batch: alle angehakten bestaetigen, dann unbestaetigte loeschen
  async function handleConfirmChecked() {
    if (checkedIds.size === 0) return;

    setConfirming(true);

    // 1. Alle angehakten einzeln bestaetigen
    let confirmed = 0;
    for (const id of checkedIds) {
      const p = provisions.find((pr) => pr.id === id);
      if (!p || !p.leadId || p.confirmed) continue;
      try {
        const res = await fetch(`/api/provisions/${p.id}/confirm`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: p.leadId }),
        });
        if (res.ok) confirmed++;
      } catch {
        // weiter
      }
    }

    // 2. Cleanup: alle nicht-bestaetigten Provisionen des Imports loeschen
    if (selectedImportId) {
      try {
        const res = await fetch("/api/provisions/cleanup", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importId: selectedImportId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.deleted > 0) {
            toast.success(
              `${confirmed} bestaetigt, ${data.deleted} nicht bestaetigte Eintraege entfernt`
            );
          } else {
            toast.success(`${confirmed} Vorschlaege bestaetigt`);
          }
        }
      } catch {
        toast.success(`${confirmed} Vorschlaege bestaetigt`);
      }
    } else {
      // Ohne ausgewaehlten Import: alle sichtbaren Import-IDs cleanen
      const importIds = [...new Set(provisions.map((p) => p.importId))];
      let totalDeleted = 0;
      for (const impId of importIds) {
        try {
          const res = await fetch("/api/provisions/cleanup", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ importId: impId }),
          });
          if (res.ok) {
            const data = await res.json();
            totalDeleted += data.deleted;
          }
        } catch {
          // weiter
        }
      }
      if (totalDeleted > 0) {
        toast.success(
          `${confirmed} bestaetigt, ${totalDeleted} nicht bestaetigte Eintraege entfernt`
        );
      } else {
        toast.success(`${confirmed} Vorschlaege bestaetigt`);
      }
    }

    fetchProvisions();
    fetchImports();
    setConfirming(false);
  }

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
        rows: data.totalRows ?? 0,
        total: data.totalBetrag ?? 0,
        matched: data.matched ?? 0,
        unmatched: data.unmatched ?? 0,
        skipped: data.skipped ?? 0,
      });
      toast.success(`${data.totalRows ?? 0} Provisionen importiert`);
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
                {importResult.skipped > 0 && (
                  <Badge variant="outline" className="border-slate-400 text-slate-600">
                    {importResult.skipped} Duplikate übersprungen
                  </Badge>
                )}
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
                    {formatDate(imp.importedAt)} -- {imp.rowCount} Zeilen -- {formatCurrency(imp.totalAmount)}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="default" className="bg-emerald-500 text-xs">
                      {imp.matchedCount}
                    </Badge>
                    <Badge variant="outline" className="border-amber-400 text-amber-700 text-xs">
                      {imp.unmatchedCount}
                    </Badge>
                    {imp.skippedCount != null && imp.skippedCount > 0 && (
                      <Badge variant="outline" className="border-slate-400 text-slate-600 text-xs">
                        {imp.skippedCount} dup.
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anleitung / Legende */}
        {provisions.length > 0 && checkedIds.size > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">So funktioniert der Provisions-Import:</p>
                  <ol className="list-decimal list-inside space-y-1 text-amber-800 dark:text-amber-300">
                    <li>Prüfe die <span className="font-medium">amber markierten Vorschläge</span> — sind die Zuordnungen korrekt?</li>
                    <li>Entferne das Häkchen bei falschen Zuordnungen</li>
                    <li>Klicke <span className="font-medium">&quot;Ausgewählte bestätigen&quot;</span> — nur bestätigte Provisionen werden gespeichert</li>
                    <li>Alle nicht bestätigten Einträge werden automatisch gelöscht</li>
                  </ol>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-amber-400" />
                      <span className="text-xs text-muted-foreground">Vorschlag — prüfen</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="text-xs text-muted-foreground">Bestätigt</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-slate-300" />
                      <span className="text-xs text-muted-foreground">Kein Lead gefunden</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-orange-500" />
                      <span className="text-xs text-muted-foreground">Abweichung — Betrag prüfen</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Provisions-Tabelle */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Provisionen
                <Badge variant="secondary">{provisions.length}</Badge>
              </CardTitle>
              {checkedIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleConfirmChecked}
                  disabled={confirming}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {checkedIds.size} ausgewählte bestätigen
                </Button>
              )}
            </div>
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
                    <SelectItem value="matched">Zugeordnet</SelectItem>
                    <SelectItem value="unmatched">Nicht zugeordnet</SelectItem>
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
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 space-y-2 ${
                        p.leadId && !p.confirmed
                          ? "border-amber-300 bg-amber-50/50"
                          : ""
                      }`}
                    >
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
                          <div className="flex items-center gap-1">
                            <LeadBadge
                              provision={p}
                              onNavigate={(leadId) => router.push(`/pipeline/${leadId}`)}
                            />
                            {!p.confirmed && (
                              <>
                                <Checkbox
                                  checked={checkedIds.has(p.id)}
                                  onCheckedChange={() => toggleChecked(p.id)}
                                  className="ml-1"
                                />
                                <button
                                  onClick={() => handleReject(p.id)}
                                  className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                  title="Vorschlag ablehnen"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
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
                        {unconfirmedCount > 0 && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                checkedIds.size > 0 &&
                                checkedIds.size ===
                                  provisions.filter((p) => p.leadId && !p.confirmed).length
                              }
                              onCheckedChange={toggleAllChecked}
                            />
                          </TableHead>
                        )}
                        <TableHead>Datum</TableHead>
                        <TableHead>Vers. Nehmer</TableHead>
                        <TableHead>Vers. Nr.</TableHead>
                        <TableHead>DATEV-Konto</TableHead>
                        <TableHead>Buchungstext</TableHead>
                        <TableHead className="text-right">Prov.Basis</TableHead>
                        <TableHead className="text-right">Satz</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead className="text-center">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provisions.map((p) => {
                        const isUnconfirmedMatch = !!(p.leadId && !p.confirmed);
                        return (
                          <TableRow
                            key={p.id}
                            className={isUnconfirmedMatch ? "bg-amber-50/50" : ""}
                          >
                            {unconfirmedCount > 0 && (
                              <TableCell className="w-10">
                                {isUnconfirmedMatch ? (
                                  <Checkbox
                                    checked={checkedIds.has(p.id)}
                                    onCheckedChange={() => toggleChecked(p.id)}
                                  />
                                ) : null}
                              </TableCell>
                            )}
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
                                <LeadBadge
                                  provision={p}
                                  onNavigate={(leadId) => router.push(`/pipeline/${leadId}`)}
                                />
                              ) : (
                                <LeadAssignDropdown
                                  provisionId={p.id}
                                  onAssigned={fetchProvisions}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isUnconfirmedMatch && (
                                <button
                                  onClick={() => handleReject(p.id)}
                                  className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                  title="Vorschlag ablehnen"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell
                          colSpan={unconfirmedCount > 0 ? 8 : 7}
                          className="text-sm font-semibold"
                        >
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
