"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { GripVertical, CalendarDays, Bell, Archive, Inbox, MoreVertical, Trash2, Tag, Plus, CheckCircle2, AlertTriangle, Clock, MessageCircle, Loader2 } from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
import { toast } from "sonner";
import type { Lead } from "@/app/(app)/pipeline/page";

interface KanbanBoardProps {
  leads: Lead[];
  phases: string[];
  productMap?: Record<number, string>;
  onPhaseChange: (leadId: number, newPhase: string) => void;
  onDelete: (id: number) => void;
  onArchive?: (id: number) => void;
  onLost?: (id: number) => void;
  onLeadUpdate?: () => void;
}

const phaseColors: Record<string, string> = {
  "Termin eingegangen": "border-t-blue-500",
  "Termin stattgefunden": "border-t-indigo-500",
  "Follow-up": "border-t-amber-500",
  "Angebot erstellt": "border-t-purple-500",
  "Abgeschlossen": "border-t-emerald-500",
  "Verloren": "border-t-red-400",
};

const phaseDotColors: Record<string, string> = {
  "Termin eingegangen": "bg-blue-500",
  "Termin stattgefunden": "bg-indigo-500",
  "Follow-up": "bg-amber-500",
  "Angebot erstellt": "bg-purple-500",
  "Abgeschlossen": "bg-emerald-500",
  "Verloren": "bg-red-400",
};

const phaseHeaderColors: Record<string, string> = {
  "Termin eingegangen": "bg-blue-500",
  "Termin stattgefunden": "bg-indigo-500",
  "Follow-up": "bg-amber-500",
  "Angebot erstellt": "bg-purple-500",
  "Abgeschlossen": "bg-emerald-500",
  "Verloren": "bg-red-400",
};

function formatCompactDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return "heute";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return "morgen";

  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export function KanbanBoard({
  leads,
  phases,
  productMap = {},
  onPhaseChange,
  onDelete,
  onArchive,
  onLost,
  onLeadUpdate,
}: KanbanBoardProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [folgeterminEdit, setFolgeterminEdit] = useState<number | null>(null);
  const [whatsappTarget, setWhatsappTarget] = useState<{ leadId: number; name: string; phone: string } | null>(null);
  const [whatsappSending, setWhatsappSending] = useState(false);

  async function handleWhatsappSend() {
    if (!whatsappTarget) return;
    const phone = whatsappTarget.phone.trim();
    if (!phone) {
      toast.error("Bitte Handynummer eingeben");
      return;
    }
    setWhatsappSending(true);
    try {
      const res = await fetch("/api/leads/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: whatsappTarget.leadId, phone }),
      });
      if (res.ok) {
        toast.success(`Erstnachricht an ${whatsappTarget.name} gesendet`);
        setWhatsappTarget(null);
        onLeadUpdate?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Versand fehlgeschlagen");
      }
    } catch {
      toast.error("Versand fehlgeschlagen");
    }
    setWhatsappSending(false);
  }

  async function handleFolgeterminSet(leadId: number, datetime: string) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, folgetermin: datetime }),
    });
    setFolgeterminEdit(null);
    toast.success("Folgetermin gesetzt");
    onLeadUpdate?.();
  }

  async function handleFolgeterminDone(leadId: number) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, folgetermin: null, folgeterminNotified: 1 }),
    });
    toast.success("Folgetermin erledigt");
    onLeadUpdate?.();
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateScrollState = () => {
      setCanScrollLeft(el.scrollLeft > 8);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    };

    const handleScroll = () => {
      updateScrollState();
      if (showScrollHint) setShowScrollHint(false);
    };

    updateScrollState();
    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [showScrollHint]);

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData("leadId", String(leadId));
  };

  const handleDrop = (e: React.DragEvent, phase: string) => {
    e.preventDefault();
    const leadId = Number(e.dataTransfer.getData("leadId"));
    if (leadId) onPhaseChange(leadId, phase);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Mobile: Collapsed-Phasen State
  const [expandedPhase, setExpandedPhase] = useState<string | null>(phases[0] || null);

  const renderLeadCard = (lead: Lead, phase: string) => {
    const now = new Date();
    const terminAbgelaufen = lead.termin && new Date(lead.termin) < now;
    const pushAktiv = lead.folgetermin && lead.folgeterminNotified === 0;
    const productName = lead.productId ? productMap[lead.productId] : null;
    const leadTyp = (lead as Lead & { leadTyp?: string }).leadTyp;

    // Warnungen berechnen
    const daysSinceCreated = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const keinTermin = !lead.termin && daysSinceCreated >= 3 && phase !== "Abgeschlossen";

    return (
      <Card
        key={lead.id}
        id={`lead-${lead.id}`}
        draggable
        onDragStart={(e) => handleDragStart(e, lead.id)}
        onClick={() => router.push(`/pipeline/${lead.id}`)}
        className={`group/card cursor-pointer border-t ${phaseColors[phase]} shadow-sm hover:shadow-md transition-shadow active:cursor-grabbing`}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${phaseDotColors[phase]}`} />
            <p className="text-sm font-semibold flex-1 min-w-0 truncate">{lead.name}</p>
            <GripVertical className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity hidden md:block" />
          </div>
          {lead.ansprechpartner && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-4 truncate">{lead.ansprechpartner}</p>
          )}
          {/* Badges: Typ + Produkt */}
          {(leadTyp || productName) && (
            <div className="flex items-center gap-1.5 mt-1.5 ml-4">
              {leadTyp && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-normal ${leadTyp === "Gewerbe" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-green-300 text-green-700 bg-green-50"}`}>
                  {leadTyp}
                </Badge>
              )}
              {productName && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 font-normal truncate max-w-[140px]">
                  <Tag className="h-2.5 w-2.5 flex-shrink-0" />
                  {productName}
                </Badge>
              )}
            </div>
          )}
          {/* Termine + Warnungen */}
          <div className="flex items-center gap-2 mt-1.5 ml-4 flex-wrap">
              {lead.termin && (
                <span className={`flex items-center gap-1 text-[11px] ${terminAbgelaufen ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                  <CalendarDays className="h-3 w-3 flex-shrink-0" />
                  {formatCompactDate(lead.termin)}
                </span>
              )}
              {lead.folgetermin && (
                <span className="flex items-center gap-1 text-[11px] text-blue-600">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  {formatCompactDate(lead.folgetermin)}
                  {pushAktiv && <Bell className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                </span>
              )}
              {keinTermin && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-600" title={`Seit ${daysSinceCreated} Tagen ohne Termin`}>
                  <AlertTriangle className="h-3 w-3" />
                  Kein Termin
                </span>
              )}
              {/* Folgetermin Schnell-Aktionen */}
              {lead.folgetermin ? (
                <button
                  type="button"
                  title="Folgetermin erledigt"
                  className="flex items-center gap-0.5 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded px-1 py-0.5 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleFolgeterminDone(lead.id); }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Erledigt</span>
                </button>
              ) : phase !== "Abgeschlossen" ? (
                folgeterminEdit === lead.id ? (
                  <input
                    type="datetime-local"
                    className="text-[11px] border rounded px-1 py-0.5 w-40"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => setFolgeterminEdit(null)}
                    onChange={(e) => {
                      if (e.target.value) handleFolgeterminSet(lead.id, e.target.value);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    title="Folgetermin setzen"
                    className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary hover:bg-accent rounded px-1 py-0.5 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setFolgeterminEdit(lead.id); }}
                  >
                    <Plus className="h-3 w-3" />
                    <span className="hidden sm:inline">Folgetermin</span>
                  </button>
                )
              ) : null}
            </div>
          <div className="flex items-center justify-between mt-2 -mb-0.5 -mr-1 ml-4">
            {phase !== "Abgeschlossen" && phase !== "Verloren" ? (
              lead.whatsappSent ? (
                <button
                  type="button"
                  title="Erstnachricht wurde bereits gesendet"
                  disabled
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 cursor-not-allowed"
                  onClick={(e) => e.stopPropagation()}
                >
                  <WhatsAppIcon className="h-3 w-3" />
                  Erstnachricht gesendet
                </button>
              ) : (
                <button
                  type="button"
                  title="WhatsApp-Erstnachricht senden"
                  className="flex items-center gap-1 text-[11px] text-[#25D366] hover:text-white hover:bg-[#25D366] border border-[#25D366]/40 hover:border-[#25D366] rounded px-1.5 py-0.5 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWhatsappTarget({
                      leadId: lead.id,
                      name: lead.ansprechpartner || lead.name,
                      phone: lead.telefon || "",
                    });
                  }}
                >
                  <WhatsAppIcon className="h-3 w-3" />
                  Erstnachricht
                </button>
              )
            ) : (
              <span />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent md:opacity-0 md:group-hover/card:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                render={<button type="button" aria-label="Aktionen" />}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
                {onArchive && phase === "Abgeschlossen" && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}>
                      <Archive className="h-4 w-4" />
                      Archivieren
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {onLost && phase !== "Abgeschlossen" && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLost(lead.id); }}>
                      <Inbox className="h-4 w-4" />
                      Kein Abschluss
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: lead.id, name: lead.name }); }}
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      {/* === MOBILE: Accordion-Ansicht nach Phase === */}
      <div className="md:hidden space-y-3">
        {phases.map((phase) => {
          const phaseLeads = leads.filter((l) => l.phase === phase);
          const isOpen = expandedPhase === phase;
          return (
            <div key={phase}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/60 border border-border/50"
                onClick={() => setExpandedPhase(isOpen ? null : phase)}
              >
                <div className={`h-2.5 w-2.5 rounded-full ${phaseHeaderColors[phase]}`} />
                <span className="text-sm font-semibold flex-1 text-left">{phase}</span>
                <Badge variant="secondary" className="text-xs">{phaseLeads.length}</Badge>
                <svg className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isOpen && (
                <div className="mt-2 space-y-2 px-1">
                  {phaseLeads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Keine Leads</p>
                  ) : (
                    phaseLeads.map((lead) => renderLeadCard(lead, phase))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* === DESKTOP: Kanban-Board === */}
      <div className="hidden md:block relative">
        <div
          ref={scrollRef}
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex gap-4 min-w-max">
            {phases.map((phase) => {
              const phaseLeads = leads.filter((l) => l.phase === phase);
              return (
                <div
                  key={phase}
                  id={`phase-${phase.replace(/\s+/g, "-").toLowerCase()}`}
                  className="w-72 flex-shrink-0"
                  onDrop={(e) => handleDrop(e, phase)}
                  onDragOver={handleDragOver}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${phaseHeaderColors[phase]}`} />
                    <h3 className="text-sm font-semibold">{phase}</h3>
                    <Badge variant="secondary" className="ml-auto text-xs">{phaseLeads.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[200px] rounded-xl bg-muted/40 p-2 border border-border/50">
                    {phaseLeads.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
                        <Inbox className="h-6 w-6 mb-2" />
                        <p className="text-xs text-center">Keine Leads in dieser Phase</p>
                      </div>
                    )}
                    {phaseLeads.map((lead) => renderLeadCard(lead, phase))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${deleteTarget?.name}" löschen?`}
        description="Der Lead und alle zugehörigen Daten werden unwiderruflich gelöscht."
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <Dialog
        open={!!whatsappTarget}
        onOpenChange={(open) => !open && !whatsappSending && setWhatsappTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              WhatsApp-Erstnachricht senden
            </DialogTitle>
          </DialogHeader>
          {whatsappTarget && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                An <span className="font-medium text-foreground">{whatsappTarget.name}</span>
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Handynummer</Label>
                <Input
                  value={whatsappTarget.phone}
                  onChange={(e) =>
                    setWhatsappTarget({ ...whatsappTarget, phone: e.target.value })
                  }
                  placeholder="+49 176 1234567"
                  autoFocus
                />
                {whatsappTarget.phone &&
                  !/^(\+?\d{1,3})?[\s-]?(01[567]\d|1[567]\d)\d{5,8}$/.test(
                    whatsappTarget.phone.replace(/[\s-]/g, ""),
                  ) && (
                    <p className="text-xs text-amber-600">
                      Das sieht nicht nach einer Handynummer aus
                    </p>
                  )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setWhatsappTarget(null)}
                  disabled={whatsappSending}
                >
                  Abbrechen
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleWhatsappSend}
                  disabled={whatsappSending || !whatsappTarget.phone.trim()}
                >
                  {whatsappSending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <MessageCircle className="h-4 w-4 mr-1" />
                  )}
                  Senden
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
