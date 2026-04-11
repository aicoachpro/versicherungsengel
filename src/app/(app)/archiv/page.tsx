"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RotateCcw, Download, ExternalLink, Archive } from "lucide-react";

interface Lead {
  id: number;
  name: string;
  phase: string;
  ansprechpartner: string | null;
  branche: string | null;
  umsatz: number | null;
  archivedAt: string | null;
}

const phaseColors: Record<string, string> = {
  "Abgeschlossen": "bg-emerald-100 text-emerald-800",
  "Verloren": "bg-red-100 text-red-800",
};

export default function ArchivPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Abgeschlossen" | "Verloren">("all");
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/leads");
    if (res.ok) {
      const all = await res.json();
      setLeads(all.filter((l: Lead) => l.archivedAt));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleRestore = async (id: number) => {
    await fetch("/api/leads/archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restore: true }),
    });
    fetchLeads();
  };

  const handleExport = (id: number) => {
    window.open(`/api/leads/export/${id}`, "_blank");
  };

  const filtered = leads.filter((l) => {
    if (statusFilter !== "all" && l.phase !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.ansprechpartner && l.ansprechpartner.toLowerCase().includes(q)) ||
      (l.branche && l.branche.toLowerCase().includes(q))
    );
  });

  const countByPhase = (phase: string) => leads.filter((l) => l.phase === phase).length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Archiv" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Archivierte Leads</CardTitle>
                <Badge variant="secondary">{leads.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-md border overflow-hidden">
                  <Button
                    variant={statusFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-8 text-xs"
                    onClick={() => setStatusFilter("all")}
                  >
                    Alle
                  </Button>
                  <Button
                    variant={statusFilter === "Abgeschlossen" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-8 text-xs border-x"
                    onClick={() => setStatusFilter("Abgeschlossen")}
                  >
                    Abgeschlossen ({countByPhase("Abgeschlossen")})
                  </Button>
                  <Button
                    variant={statusFilter === "Verloren" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-none h-8 text-xs"
                    onClick={() => setStatusFilter("Verloren")}
                  >
                    Kein Abschluss ({countByPhase("Verloren")})
                  </Button>
                </div>
                <div className="relative max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Laden...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Keine archivierten Leads</p>
                <p className="text-sm mt-1">
                  {searchQuery ? "Keine Treffer für diese Suche" : "Archivierte Leads erscheinen hier"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Ansprechpartner</TableHead>
                    <TableHead>Branche</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Umsatz</TableHead>
                    <TableHead>Archiviert am</TableHead>
                    <TableHead className="w-32">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.ansprechpartner || "–"}</TableCell>
                      <TableCell>{lead.branche || "–"}</TableCell>
                      <TableCell>
                        <Badge className={phaseColors[lead.phase] || "bg-gray-100 text-gray-800"}>
                          {lead.phase === "Verloren" ? "Kein Abschluss" : lead.phase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.umsatz
                          ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(lead.umsatz)
                          : "–"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.archivedAt
                          ? new Date(lead.archivedAt).toLocaleDateString("de-DE")
                          : "–"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => router.push(`/pipeline/${lead.id}`)}
                            title="Details"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleExport(lead.id)}
                            title="Übergabedokument"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-primary hover:text-primary"
                            onClick={() => handleRestore(lead.id)}
                            title="Wiederherstellen"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
