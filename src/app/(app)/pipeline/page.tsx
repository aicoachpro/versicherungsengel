"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { LeadDialog } from "@/components/pipeline/lead-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

export interface Lead {
  id: number;
  name: string;
  phase: string;
  termin: string | null;
  ansprechpartner: string | null;
  email: string | null;
  telefon: string | null;
  website: string | null;
  gewerbeart: string | null;
  branche: string | null;
  unternehmensgroesse: string | null;
  umsatzklasse: string | null;
  terminKosten: number | null;
  umsatz: number | null;
  conversion: number | null;
  naechsterSchritt: string | null;
  notizen: string | null;
  eingangsdatum: string | null;
  folgetermin: string | null;
  folgeterminNotified: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PHASES = [
  "Termin eingegangen",
  "Termin stattgefunden",
  "Follow-up",
  "Angebot erstellt",
  "Abgeschlossen",
  "Verloren",
] as const;

const OPEN_PHASES = ["Termin eingegangen", "Termin stattgefunden", "Follow-up", "Angebot erstellt"];

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineContent />
    </Suspense>
  );
}

function PipelineContent() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Query-Parameter als Filter auswerten + zur Spalte/Kachel scrollen
  useEffect(() => {
    const filter = searchParams.get("filter");
    const phase = searchParams.get("phase");
    const gewerbeart = searchParams.get("gewerbeart");
    const scrollToPhase = searchParams.get("scrollToPhase");
    const leadId = searchParams.get("leadId");

    if (filter) setActiveFilter(`filter:${filter}`);
    else if (phase) setActiveFilter(`phase:${phase}`);
    else if (gewerbeart) setActiveFilter(`gewerbeart:${gewerbeart}`);

    // Scroll zur Phase-Spalte
    const targetPhase = scrollToPhase || phase;
    if (targetPhase) {
      setTimeout(() => {
        const el = document.getElementById(`phase-${targetPhase.replace(/\s+/g, "-").toLowerCase()}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }, 150);
    }

    // Scroll zur Lead-Kachel + Highlight
    if (leadId) {
      setTimeout(() => {
        const el = document.getElementById(`lead-${leadId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
        }
      }, 300);
    }
  }, [searchParams]);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.ok) setLeads(await res.json());
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handlePhaseChange = async (leadId: number, newPhase: string) => {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: leadId,
        phase: newPhase,
        conversion: newPhase === "Abgeschlossen" ? 1 : newPhase === "Verloren" ? 0 : null,
      }),
    });
    fetchLeads();
  };

  const handleSave = async (data: Partial<Lead>) => {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    toast.success("Lead erstellt");
    setDialogOpen(false);
    fetchLeads();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    toast.success("Lead gelöscht");
    fetchLeads();
  };

  const handleArchive = async (id: number) => {
    await fetch("/api/leads/archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Lead archiviert");
    fetchLeads();
  };

  const clearFilter = () => {
    setActiveFilter(null);
    window.history.replaceState(null, "", "/pipeline");
  };

  // Filter: nicht-archivierte Leads + Suchfilter + Dashboard-Filter
  const filteredLeads = leads
    .filter((l) => !l.archivedAt)
    .filter((l) => {
      if (!activeFilter) return true;
      const [type, value] = activeFilter.split(":");
      if (type === "filter" && value === "offen") return OPEN_PHASES.includes(l.phase);
      if (type === "filter" && value === "abgeschlossen") return l.phase === "Abgeschlossen";
      if (type === "phase") return l.phase === value;
      if (type === "gewerbeart") return l.gewerbeart?.toLowerCase() === value.toLowerCase();
      return true;
    })
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.ansprechpartner && l.ansprechpartner.toLowerCase().includes(q)) ||
        (l.branche && l.branche.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q))
      );
    });

  const activeCount = leads.filter((l) => !l.archivedAt).length;

  const filterLabel = activeFilter
    ? {
        "filter:offen": "Offene Leads",
        "filter:abgeschlossen": "Abgeschlossen",
      }[activeFilter] || activeFilter.split(":")[1]
    : null;

  return (
    <div className="flex flex-col h-full">
      <Header title="Sales Pipeline" />
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {activeFilter ? `${filteredLeads.length} von ${activeCount}` : `${activeCount}`} Leads aktiv
          </p>
          {filterLabel && (
            <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={clearFilter}>
              {filterLabel}
              <X className="h-3 w-3" />
            </Badge>
          )}
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Kontakt, Branche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neuer Lead
        </Button>
      </div>
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <KanbanBoard
          leads={filteredLeads}
          phases={PHASES as unknown as string[]}
          onPhaseChange={handlePhaseChange}
          onDelete={handleDelete}
          onArchive={handleArchive}
        />
      </div>
      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={null}
        onSave={handleSave}
      />
    </div>
  );
}
