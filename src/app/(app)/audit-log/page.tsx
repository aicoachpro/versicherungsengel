"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ClipboardList,
  Loader2,
} from "lucide-react";

interface AuditEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: number;
  entityName: string | null;
  changes: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Erstellt", color: "bg-green-100 text-green-800" },
  update: { label: "Geaendert", color: "bg-blue-100 text-blue-800" },
  delete: { label: "Geloescht", color: "bg-red-100 text-red-800" },
  archive: { label: "Archiviert", color: "bg-amber-100 text-amber-800" },
  restore: { label: "Wiederhergestellt", color: "bg-purple-100 text-purple-800" },
  login: { label: "Login", color: "bg-gray-100 text-gray-800" },
};

const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  insurance: "Versicherung",
  activity: "Aktivitaet",
  document: "Dokument",
  user: "Nutzer",
};

const PAGE_SIZE = 50;

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "gerade eben";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `vor ${weeks} ${weeks === 1 ? "Woche" : "Wochen"}`;
  }

  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChanges(changes: string | null): string {
  if (!changes) return "";
  try {
    const parsed = JSON.parse(changes);
    const { updatedAt, ...rest } = parsed;
    const entries = Object.entries(rest);
    if (entries.length === 0) return "";
    return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
  } catch {
    return changes;
  }
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Debounce fuer Suchfeld
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setOffset(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (entityFilter !== "all") params.set("entity", entityFilter);
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

    try {
      const res = await fetch(`/api/audit-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [offset, entityFilter, actionFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <Header title="Audit-Log" />
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Aktivitaetsprotokoll
              <Badge variant="secondary">{total}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter-Leiste */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Nutzer, Objekt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={actionFilter}
                  onValueChange={(v) => {
                    if (v) {
                      setActionFilter(v);
                      setOffset(0);
                    }
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Alle Aktionen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Aktionen</SelectItem>
                    <SelectItem value="create">Erstellt</SelectItem>
                    <SelectItem value="update">Geaendert</SelectItem>
                    <SelectItem value="delete">Geloescht</SelectItem>
                    <SelectItem value="archive">Archiviert</SelectItem>
                    <SelectItem value="restore">Wiederhergestellt</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={entityFilter}
                  onValueChange={(v) => {
                    if (v) {
                      setEntityFilter(v);
                      setOffset(0);
                    }
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Alle Bereiche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Bereiche</SelectItem>
                    <SelectItem value="lead">Leads</SelectItem>
                    <SelectItem value="insurance">Versicherungen</SelectItem>
                    <SelectItem value="activity">Aktivitaeten</SelectItem>
                    <SelectItem value="document">Dokumente</SelectItem>
                    <SelectItem value="user">Nutzer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabelle */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Zeitpunkt</TableHead>
                    <TableHead className="w-[120px]">Benutzer</TableHead>
                    <TableHead className="w-[130px]">Aktion</TableHead>
                    <TableHead className="w-[110px]">Bereich</TableHead>
                    <TableHead>Objekt</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Lade Eintraege...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ClipboardList className="h-8 w-8 opacity-50" />
                          <p>Noch keine Eintraege im Audit-Log</p>
                          {(debouncedSearch || entityFilter !== "all" || actionFilter !== "all") && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => {
                                setSearchTerm("");
                                setDebouncedSearch("");
                                setEntityFilter("all");
                                setActionFilter("all");
                                setOffset(0);
                              }}
                            >
                              Filter zuruecksetzen
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const actionStyle =
                        ACTION_LABELS[log.action] || {
                          label: log.action,
                          color: "bg-gray-100 text-gray-800",
                        };
                      return (
                        <TableRow key={log.id}>
                          <TableCell
                            className="text-sm"
                            title={formatFullDate(log.createdAt)}
                          >
                            {relativeTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.userName || "System"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={actionStyle.color}
                            >
                              {actionStyle.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {ENTITY_LABELS[log.entity] || log.entity}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {log.entityName || `#${log.entityId}`}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                            {formatChanges(log.changes)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginierung */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Zurueck
                </Button>
                <span className="text-sm text-muted-foreground">
                  Seite {currentPage} von {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total || loading}
                >
                  Weiter
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
