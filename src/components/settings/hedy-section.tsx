"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Check,
  Loader2,
  RefreshCw,
  CircleCheck,
  CircleX,
  Link2,
  EyeOff,
} from "lucide-react";

interface HedySettingsProps {
  settings: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
}

interface HedySessionRow {
  id: number;
  sessionId: string;
  title: string | null;
  startedAt: string | null;
  endedAt: string | null;
  participants: Array<{ name?: string; email?: string }> | null;
  leadId: number | null;
  leadName: string | null;
  matchStatus: string;
  matchConfidence: number | null;
  matchReason: string | null;
  errorMessage: string | null;
  importedAt: string;
}

interface LeadLite {
  id: number;
  name: string;
  ansprechpartner: string | null;
  termin: string | null;
}

export function HedySection({ settings, onSave }: HedySettingsProps) {
  const [values, setValues] = useState<Record<string, string>>({
    "hedy.apiKey": settings["hedy.apiKey"] || "",
    "hedy.region": settings["hedy.region"] || "eu",
    "hedy.autoImport": settings["hedy.autoImport"] || "true",
    "hedy.matchWindowMinutes": settings["hedy.matchWindowMinutes"] || "240",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [sessions, setSessions] = useState<HedySessionRow[]>([]);
  const [filter, setFilter] = useState<string>("unmatched");

  useEffect(() => {
    setValues({
      "hedy.apiKey": settings["hedy.apiKey"] || "",
      "hedy.region": settings["hedy.region"] || "eu",
      "hedy.autoImport": settings["hedy.autoImport"] || "true",
      "hedy.matchWindowMinutes": settings["hedy.matchWindowMinutes"] || "240",
    });
  }, [settings]);

  const loadSessions = async (status: string) => {
    const url = status === "all" ? "/api/hedy/sessions" : `/api/hedy/sessions?status=${status}`;
    const res = await fetch(url);
    if (res.ok) setSessions(await res.json());
  };

  useEffect(() => {
    loadSessions(filter);
  }, [filter]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave(values);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/hedy/test", { method: "POST" });
      const data = await res.json();
      setTestResult({ ok: Boolean(data.ok), message: data.message || (data.ok ? "OK" : "Fehler") });
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleImportNow = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/hedy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult(
          `${data.matched} zugeordnet · ${data.unmatched} unmatched · ${data.skipped} uebersprungen · ${data.errors} Fehler`,
        );
        await loadSessions(filter);
      } else {
        setImportResult(`Fehler: ${data.error}`);
      }
    } catch (err) {
      setImportResult(`Fehler: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const lastStatus = settings["hedy.lastImportStatus"];
  const lastAt = settings["hedy.lastImportAt"];
  const lastMsg = settings["hedy.lastImportMessage"];

  const isActive =
    Boolean(settings["hedy.apiKey"]) &&
    settings["hedy.apiKey"] !== "***" &&
    !settings["hedy.apiKey"].includes("...")
      ? settings["hedy.apiKey"].length > 0
      : Boolean(settings["hedy.apiKey"]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Hedy (Gespraechsnotizen)
            </h3>
            <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Aktiv" : "Nicht konfiguriert"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Importiert Gespraechsnotizen automatisch nach jedem Kundentermin. Verbindet Hedy-Sitzungen mit Leads ueber Termin-Zeitpunkt und Teilnehmer.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API-Key</Label>
            <Input
              type="password"
              placeholder="Hedy API-Key"
              value={values["hedy.apiKey"] || ""}
              onChange={(e) => setValues((prev) => ({ ...prev, "hedy.apiKey": e.target.value }))}
              onFocus={(e) => {
                const val = e.target.value;
                if (val.includes("...") && val.length <= 10) {
                  setValues((prev) => ({ ...prev, "hedy.apiKey": "" }));
                }
              }}
            />
            <p className="text-xs text-muted-foreground">Bearer Token aus deinem Hedy-Account (www.hedy.ai &rarr; Integrationen).</p>
          </div>

          <div className="space-y-2">
            <Label>Region</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={values["hedy.region"] || "eu"}
              onChange={(e) => setValues((prev) => ({ ...prev, "hedy.region": e.target.value }))}
            >
              <option value="eu">EU (eu-api.hedy.bot)</option>
              <option value="us">US (api.hedy.bot)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Auto-Import aktiv</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={values["hedy.autoImport"] || "true"}
              onChange={(e) => setValues((prev) => ({ ...prev, "hedy.autoImport": e.target.value }))}
            >
              <option value="true">Ja &ndash; stuendlich Sessions pruefen</option>
              <option value="false">Nein &ndash; nur manuell</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Matching-Fenster (Minuten)</Label>
            <Input
              type="number"
              min="30"
              max="720"
              value={values["hedy.matchWindowMinutes"] || "240"}
              onChange={(e) => setValues((prev) => ({ ...prev, "hedy.matchWindowMinutes": e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Wie viele Minuten vor/nach dem Sessionstart darf ein Termin liegen, damit der Lead als Kandidat gilt. Default 240 (+/- 4h).
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
              {saving ? "Speichere..." : saved ? "Gespeichert" : "Speichern"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {testing ? "Teste..." : "Verbindung testen"}
            </Button>
            <Button variant="outline" onClick={handleImportNow} disabled={importing} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {importing ? "Importiere..." : "Jetzt importieren"}
            </Button>
          </div>

          {testResult && (
            <p className={`text-sm flex items-center gap-2 ${testResult.ok ? "text-emerald-600" : "text-destructive"}`}>
              {testResult.ok ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
              {testResult.message}
            </p>
          )}
          {importResult && <p className="text-sm text-muted-foreground">{importResult}</p>}

          {lastAt && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              <div>
                Letzter Lauf: {new Date(lastAt).toLocaleString("de-DE")} &middot;{" "}
                <span className={lastStatus === "success" ? "text-emerald-600" : lastStatus === "error" ? "text-destructive" : ""}>
                  {lastStatus}
                </span>
              </div>
              {lastMsg && <div>{lastMsg}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Hedy-Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Zugeordnete, unmatched und uebersprungene Sessions. Unmatched lassen sich manuell einem Lead zuweisen oder ignorieren.
          </p>
          <div className="flex gap-2 pt-2">
            {[
              { v: "unmatched", l: "Unmatched" },
              { v: "matched", l: "Matched" },
              { v: "manual", l: "Manuell" },
              { v: "ignored", l: "Ignoriert" },
              { v: "error", l: "Fehler" },
              { v: "all", l: "Alle" },
            ].map((f) => (
              <Button
                key={f.v}
                variant={filter === f.v ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.v)}
              >
                {f.l}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Keine Sessions im Filter &quot;{filter}&quot;.</p>
          ) : (
            sessions.map((s) => <SessionRow key={s.id} session={s} onChange={() => loadSessions(filter)} />)
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SessionRow({ session, onChange }: { session: HedySessionRow; onChange: () => void }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const openAssign = async () => {
    setAssignOpen(true);
    if (leads.length === 0) {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const all = (await res.json()) as LeadLite[];
        setLeads(all);
      }
    }
  };

  const assign = async (leadId: number) => {
    setBusy(true);
    const res = await fetch(`/api/hedy/sessions/${session.sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", leadId }),
    });
    setBusy(false);
    if (res.ok) {
      setAssignOpen(false);
      onChange();
    }
  };

  const ignore = async () => {
    setBusy(true);
    const res = await fetch(`/api/hedy/sessions/${session.sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ignore" }),
    });
    setBusy(false);
    if (res.ok) onChange();
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(s) ||
      (l.ansprechpartner || "").toLowerCase().includes(s)
    );
  }).slice(0, 20);

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{session.title || "(ohne Titel)"}</div>
          <div className="text-xs text-muted-foreground">
            {session.startedAt ? new Date(session.startedAt).toLocaleString("de-DE") : "?"}
            {session.participants && session.participants.length > 0 && (
              <> &middot; {session.participants.map((p) => p.name || p.email).filter(Boolean).join(", ")}</>
            )}
          </div>
          {session.leadName && (
            <div className="text-xs mt-1">
              <Badge variant="default">Lead: {session.leadName}</Badge>
              {session.matchConfidence !== null && (
                <span className="ml-2 text-muted-foreground">Score {session.matchConfidence.toFixed(2)}</span>
              )}
            </div>
          )}
          {session.matchReason && (
            <div className="text-xs text-muted-foreground mt-1 italic">{session.matchReason}</div>
          )}
          {session.errorMessage && (
            <div className="text-xs text-destructive mt-1">{session.errorMessage}</div>
          )}
        </div>
        {session.matchStatus === "unmatched" && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={openAssign} disabled={busy}>Zuordnen</Button>
            <Button size="sm" variant="ghost" onClick={ignore} disabled={busy}>
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {assignOpen && (
        <div className="border-t pt-2 space-y-2">
          <Input
            placeholder="Lead suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filtered.map((l) => (
              <button
                key={l.id}
                type="button"
                className="w-full text-left text-sm px-2 py-1 hover:bg-accent rounded"
                onClick={() => assign(l.id)}
                disabled={busy}
              >
                <span className="font-medium">{l.name}</span>
                {l.ansprechpartner && <span className="text-muted-foreground"> &middot; {l.ansprechpartner}</span>}
                {l.termin && <span className="text-xs text-muted-foreground ml-2">{new Date(l.termin).toLocaleDateString("de-DE")}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground italic p-2">Kein Lead gefunden.</p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>Abbrechen</Button>
        </div>
      )}
    </div>
  );
}
