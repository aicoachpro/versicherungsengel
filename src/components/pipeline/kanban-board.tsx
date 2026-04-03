"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2, GripVertical, CalendarDays, Bell, Archive, Inbox } from "lucide-react";
import type { Lead } from "@/app/(app)/pipeline/page";

interface KanbanBoardProps {
  leads: Lead[];
  phases: string[];
  onPhaseChange: (leadId: number, newPhase: string) => void;
  onDelete: (id: number) => void;
  onArchive?: (id: number) => void;
}

const phaseColors: Record<string, string> = {
  "Termin eingegangen": "border-t-blue-500",
  "Termin stattgefunden": "border-t-sky-500",
  "Follow-up": "border-t-amber-500",
  "Angebot erstellt": "border-t-purple-500",
  "Abgeschlossen": "border-t-emerald-500",
  "Verloren": "border-t-red-400",
};

const phaseHeaderColors: Record<string, string> = {
  "Termin eingegangen": "bg-blue-500",
  "Termin stattgefunden": "bg-sky-500",
  "Follow-up": "bg-amber-500",
  "Angebot erstellt": "bg-purple-500",
  "Abgeschlossen": "bg-emerald-500",
  "Verloren": "bg-red-400",
};

export function KanbanBoard({
  leads,
  phases,
  onPhaseChange,
  onDelete,
  onArchive,
}: KanbanBoardProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
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

  return (
    <>
      <div className="relative">
        {/* Scroll-Hint nur auf Mobile, verschwindet nach erstem Scrollen */}
        {showScrollHint && (
          <div className="md:hidden text-center text-xs text-muted-foreground/60 pb-2 animate-pulse">
            &larr; Wischen zum Scrollen &rarr;
          </div>
        )}

        {/* Scroll-Container */}
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
                <Badge variant="secondary" className="ml-auto text-xs">
                  {phaseLeads.length}
                </Badge>
              </div>
              <div className="space-y-3 min-h-[200px] rounded-xl bg-muted/40 p-2 border border-border/50">
                {phaseLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
                    <Inbox className="h-6 w-6 mb-2" />
                    <p className="text-xs text-center">Keine Leads in dieser Phase</p>
                  </div>
                )}
                {phaseLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    id={`lead-${lead.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onClick={() => router.push(`/pipeline/${lead.id}`)}
                    className={`cursor-pointer border-t-2 ${phaseColors[phase]} shadow-sm hover:shadow-md transition-all active:cursor-grabbing`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lead.name}
                          </p>
                          {lead.ansprechpartner && (
                            <p className="text-xs text-muted-foreground truncate">
                              {lead.ansprechpartner}
                            </p>
                          )}
                        </div>
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      </div>
                      {(() => {
                        const now = new Date();
                        const terminAbgelaufen = lead.termin && new Date(lead.termin) < now;
                        const aktiverTermin = terminAbgelaufen && lead.folgetermin
                          ? { datum: lead.folgetermin, label: "Folgetermin" }
                          : lead.termin
                            ? { datum: lead.termin, label: "Termin" }
                            : null;
                        const pushAktiv = lead.folgetermin && lead.folgeterminNotified === 0;

                        return (
                          <>
                            {aktiverTermin && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs">
                                <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                <span className="font-medium">
                                  {aktiverTermin.label}:{" "}
                                  {new Date(aktiverTermin.datum).toLocaleString("de-DE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {pushAktiv && (
                                  <span title="Push-Erinnerung aktiv">
                                    <Bell className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap gap-1">
                              {lead.branche && (
                                <Badge variant="outline" className="text-xs">
                                  {lead.branche}
                                </Badge>
                              )}
                            </div>
                          </>
                        );
                      })()}
                      {lead.umsatz != null && lead.umsatz > 0 && (
                        <p className="mt-2 text-xs font-medium text-emerald-600">
                          {new Intl.NumberFormat("de-DE", {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          }).format(lead.umsatz)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-end gap-1">
                        {onArchive && (phase === "Abgeschlossen" || phase === "Verloren") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}
                            aria-label={`${lead.name} archivieren`}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: lead.id, name: lead.name }); }}
                          aria-label={`${lead.name} löschen`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
        </div>

        {/* Fade-Gradient links (Mobile only) */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent md:hidden" />
        )}

        {/* Fade-Gradient rechts (Mobile only) */}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
        )}
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`"${deleteTarget?.name}" löschen?`}
        description="Der Lead und alle zugehörigen Daten werden unwiderruflich gelöscht."
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
