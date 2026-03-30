"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
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
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  update: { label: "Geändert", color: "bg-blue-100 text-blue-800" },
  delete: { label: "Gelöscht", color: "bg-red-100 text-red-800" },
  archive: { label: "Archiviert", color: "bg-amber-100 text-amber-800" },
  restore: { label: "Wiederhergestellt", color: "bg-purple-100 text-purple-800" },
};

const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  insurance: "Versicherung",
  activity: "Aktivität",
  document: "Dokument",
  user: "Nutzer",
};

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (entityFilter !== "all") params.set("entity", entityFilter);

    const res = await fetch(`/api/audit-log?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
  }, [offset, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function formatDate(iso: string) {
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
      // updatedAt rausfiltern — nicht relevant für den User
      const { updatedAt, ...rest } = parsed;
      const entries = Object.entries(rest);
      if (entries.length === 0) return "";
      return entries
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    } catch {
      return changes;
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <Header title="Audit-Log" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} Einträge gesamt
          </p>
          <Select value={entityFilter} onValueChange={(v) => { if (v) { setEntityFilter(v); setOffset(0); } }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Alle Bereiche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Bereiche</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="insurance">Versicherungen</SelectItem>
              <SelectItem value="activity">Aktivitäten</SelectItem>
              <SelectItem value="document">Dokumente</SelectItem>
              <SelectItem value="user">Nutzer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Zeitpunkt</TableHead>
                <TableHead className="w-[120px]">Nutzer</TableHead>
                <TableHead className="w-[120px]">Aktion</TableHead>
                <TableHead className="w-[110px]">Bereich</TableHead>
                <TableHead>Objekt</TableHead>
                <TableHead>Änderungen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Keine Einträge
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const actionStyle = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-800" };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                      <TableCell className="text-sm">{log.userName || "System"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={actionStyle.color}>
                          {actionStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ENTITY_LABELS[log.entity] || log.entity}</TableCell>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Zurück
            </Button>
            <span className="text-sm text-muted-foreground">
              Seite {currentPage} von {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
            >
              Weiter
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
