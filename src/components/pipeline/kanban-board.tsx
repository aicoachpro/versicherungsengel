"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Edit2, Trash2, GripVertical, ExternalLink, CalendarDays, Bell, Archive } from "lucide-react";
import type { Lead } from "@/app/(app)/pipeline/page";

interface KanbanBoardProps {
  leads: Lead[];
  phases: string[];
  onPhaseChange: (leadId: number, newPhase: string) => void;
  onEdit: (lead: Lead) => void;
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
  onEdit,
  onDelete,
  onArchive,
}: KanbanBoardProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

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
      <div className="flex gap-4 min-w-max">
        {phases.map((phase) => {
          const phaseLeads = leads.filter((l) => l.phase === phase);
          return (
            <div
              key={phase}
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
              <div className="space-y-3 min-h-[200px] rounded-lg bg-muted/50 p-2">
                {phaseLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className={`cursor-grab border-t-2 ${phaseColors[phase]} hover:shadow-md transition-shadow active:cursor-grabbing`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium truncate text-left hover:text-primary hover:underline cursor-pointer"
                            onClick={() => router.push(`/pipeline/${lead.id}`)}
                          >
                            {lead.name}
                          </button>
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
                      <div className="mt-2 flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs px-2"
                          onClick={() => router.push(`/pipeline/${lead.id}`)}
                          aria-label={`Details für ${lead.name}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Details
                        </Button>
                        <div className="ml-auto flex gap-1">
                          {onArchive && (phase === "Abgeschlossen" || phase === "Verloren") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => onArchive(lead.id)}
                              aria-label={`${lead.name} archivieren`}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => onEdit(lead)}
                            aria-label={`${lead.name} bearbeiten`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: lead.id, name: lead.name })}
                            aria-label={`${lead.name} löschen`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
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
