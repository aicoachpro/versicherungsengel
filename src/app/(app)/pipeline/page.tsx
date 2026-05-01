"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { LeadDialog } from "@/components/pipeline/lead-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, X, Users, User } from "lucide-react";
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
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  gewerbeart: string | null;
  leadTyp: string | null;
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
  folgeterminTyp: string | null;
  folgeterminNotified: number;
  reklamiertAt: string | null;
  archivedAt: string | null;
  providerId: number | null;
  assignedTo: number | null;
  productId: number | null;
  createdAt: string;
  updatedAt: string;
  whatsappSent?: boolean;
}

export interface LeadProduct {
  id: number;
  name: string;
  active: boolean;
  sortOrder: number;
}

const PHASES = [
  "Termin eingegangen",
  "Termin stattgefunden",
  "Follow-up",
  "Angebot erstellt",
  "Abgeschlossen",
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
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [showAll, setShowAll] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [productMap, setProductMap] = useState<Record<number, string>>({});
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filterMonat, setFilterMonat] = useState<string>("alle");
  const [filterJahr, setFilterJahr] = useState<string>("alle");

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

    // Scroll zur Lead-Kachel + Highlight (einzeln oder mehrere)
    const highlightIds = searchParams.get("highlight")?.split(",").map(Number).filter(Boolean) || [];
    if (leadId) highlightIds.push(Number(leadId));

    if (highlightIds.length > 0) {
      setTimeout(() => {
        let scrolled = false;
        for (const hId of highlightIds) {
          const el = document.getElementById(`lead-${hId}`);
          if (el) {
            if (!scrolled) {
              el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
              scrolled = true;
            }
            el.classList.add("ring-2", "ring-primary", "ring-offset-2");
            setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 5000);
          }
        }
      }, 300);
    }
  }, [searchParams]);

  const fetchLeads = useCallback(async () => {
    const url = isAdmin && !showAll ? "/api/leads?showAll=0" : "/api/leads";
    const res = await fetch(url);
    if (res.ok) setLeads(await res.json());
  }, [isAdmin, showAll]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Products einmalig laden fuer Kanban-Card-Badges
  useEffect(() => {
    fetch("/api/lead-products?active=true")
      .then((r) => r.ok ? r.json() : [])
      .then((products: LeadProduct[]) => {
        const map: Record<number, string> = {};
        products.forEach((p) => { map[p.id] = p.name; });
        setProductMap(map);
      });
  }, []);

  // Users einmalig laden fuer Bearbeiter-Anzeige auf Kacheln
  useEffect(() => {
    fetch("/api/users?simple=1")
      .then((r) => r.ok ? r.json() : [])
      .then((list: Array<{ id: number; name: string }>) => {
        const map: Record<number, string> = {};
        list.forEach((u) => { map[u.id] = u.name; });
        setUserMap(map);
      });
  }, []);

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
    const res = await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Löschen fehlgeschlagen");
      return;
    }
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

  const handleLost = async (id: number) => {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, phase: "Verloren", conversion: 0 }),
    });
    await fetch("/api/leads/archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Lead als verloren markiert und archiviert");
    fetchLeads();
  };

  const clearFilter = () => {
    setActiveFilter(null);
    window.history.replaceState(null, "", "/pipeline");
  };

  // Filter: nicht-archivierte Leads + Suchfilter + Dashboard-Filter
  const filteredLeads = leads
    .filter((l) => !l.archivedAt && !l.reklamiertAt)
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
    })
    .filter((l) => {
      const datum = l.eingangsdatum || l.createdAt;
      if (!datum) return true;
      const d = new Date(datum);
      if (filterJahr !== "alle" && d.getFullYear() !== parseInt(filterJahr)) return false;
      if (filterMonat !== "alle" && (d.getMonth() + 1) !== parseInt(filterMonat)) return false;
      return true;
    });

  const activeCount = leads.filter((l) => !l.archivedAt && !l.reklamiertAt).length;

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
          {isAdmin && (
            <Button
              variant={showAll ? "outline" : "default"}
              size="sm"
              className="gap-1 h-9"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {showAll ? "Alle" : "Meine"}
            </Button>
          )}
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
          <Select value={filterMonat} onValueChange={(v) => { if (v) setFilterMonat(v); }}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Monat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Monate</SelectItem>
              <SelectItem value="1">Januar</SelectItem>
              <SelectItem value="2">Februar</SelectItem>
              <SelectItem value="3">März</SelectItem>
              <SelectItem value="4">April</SelectItem>
              <SelectItem value="5">Mai</SelectItem>
              <SelectItem value="6">Juni</SelectItem>
              <SelectItem value="7">Juli</SelectItem>
              <SelectItem value="8">August</SelectItem>
              <SelectItem value="9">September</SelectItem>
              <SelectItem value="10">Oktober</SelectItem>
              <SelectItem value="11">November</SelectItem>
              <SelectItem value="12">Dezember</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterJahr} onValueChange={(v) => { if (v) setFilterJahr(v); }}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="Jahr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Jahre</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neuer Lead
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <KanbanBoard
          leads={filteredLeads}
          phases={PHASES as unknown as string[]}
          productMap={productMap}
          userMap={userMap}
          onPhaseChange={handlePhaseChange}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onLost={handleLost}
          onLeadUpdate={fetchLeads}
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
