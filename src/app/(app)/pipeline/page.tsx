"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { LeadDialog } from "@/components/pipeline/lead-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

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

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
    if (editingLead) {
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingLead.id, ...data }),
      });
    } else {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setDialogOpen(false);
    setEditingLead(null);
    fetchLeads();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    fetchLeads();
  };

  const handleArchive = async (id: number) => {
    await fetch("/api/leads/archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchLeads();
  };

  // Filter: nicht-archivierte Leads + Suchfilter
  const filteredLeads = leads
    .filter((l) => !l.archivedAt)
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

  return (
    <div className="flex flex-col h-full">
      <Header title="Sales Pipeline" />
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {activeCount} Leads aktiv
          </p>
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
          onClick={() => {
            setEditingLead(null);
            setDialogOpen(true);
          }}
          className="bg-[#003781] hover:bg-[#002a63]"
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
          onEdit={(lead) => {
            setEditingLead(lead);
            setDialogOpen(true);
          }}
          onDelete={handleDelete}
          onArchive={handleArchive}
        />
      </div>
      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        onSave={handleSave}
      />
    </div>
  );
}
