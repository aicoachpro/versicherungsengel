"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, Pencil, Check, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Lead {
  id: number;
  name: string;
  ansprechpartner: string | null;
  phase: string;
  terminKosten: number | null;
  eingangsdatum: string | null;
  reklamiertAt: string | null;
  reklamationStatus: string | null;
  reklamationNotiz: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  offen: { label: "Offen", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  genehmigt: { label: "Genehmigung erhalten", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  abgelehnt: { label: "Abgelehnt", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function ReklamationenPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ leadId: number; status: string; name: string } | null>(null);
  const [editingNotiz, setEditingNotiz] = useState<{ leadId: number; value: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/leads/reklamation");
    if (res.ok) {
      setLeads(await res.json());
    }
    setLoading(false);
  }

  async function handleStatusChange(leadId: number, status: string) {
    const res = await fetch("/api/leads/reklamation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, status }),
    });
    if (res.ok) {
      toast.success(status === "genehmigt"
        ? "Genehmigung erhalten — Terminkosten gutgeschrieben"
        : "Reklamation abgelehnt — Kosten bleiben bestehen");
      loadData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Fehler");
    }
    setConfirmAction(null);
  }

  async function handleNotizSave(leadId: number, notiz: string) {
    const res = await fetch("/api/leads/reklamation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, notiz }),
    });
    if (res.ok) {
      toast.success("Begründung aktualisiert");
      setEditingNotiz(null);
      loadData();
    } else {
      toast.error("Fehler beim Speichern");
    }
  }

  function NotizCell({ lead }: { lead: Lead }) {
    const isEditing = editingNotiz?.leadId === lead.id;
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editingNotiz.value}
            onChange={(e) => setEditingNotiz({ leadId: lead.id, value: e.target.value })}
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNotizSave(lead.id, editingNotiz.value);
              if (e.key === "Escape") setEditingNotiz(null);
            }}
          />
          <Button size="icon-xs" variant="ghost" onClick={() => handleNotizSave(lead.id, editingNotiz.value)}>
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => setEditingNotiz(null)}>
            <X className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 group">
        <span className="truncate">{lead.reklamationNotiz || "—"}</span>
        <Button
          size="icon-xs"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setEditingNotiz({ leadId: lead.id, value: lead.reklamationNotiz || "" })}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  const offene = leads.filter((l) => l.reklamationStatus === "offen");
  const erledigte = leads.filter((l) => l.reklamationStatus !== "offen");

  return (
    <>
      <Header title="Reklamationen" />
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Offene Reklamationen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Offene Reklamationen
              <Badge variant="secondary">{offene.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offene.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Keine offenen Reklamationen</p>
            ) : (
              <>
                {/* Mobile: Karten-Ansicht */}
                <div className="md:hidden space-y-3">
                  {offene.map((lead) => (
                    <div key={lead.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            className="font-medium text-blue-600 hover:underline text-sm"
                            onClick={() => router.push(`/pipeline/${lead.id}`)}
                          >
                            {lead.name}
                          </button>
                          {lead.ansprechpartner && (
                            <p className="text-xs text-muted-foreground">{lead.ansprechpartner}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">{lead.terminKosten ?? 320}€</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Reklamiert: {lead.reklamiertAt ? new Date(lead.reklamiertAt).toLocaleDateString("de-DE") : "—"}</span>
                      </div>
                      <div className="text-xs">
                        <NotizCell lead={lead} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 flex-1"
                          onClick={() => setConfirmAction({ leadId: lead.id, status: "genehmigt", name: lead.name })}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Genehmigung erhalten
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 flex-1 text-destructive"
                          onClick={() => setConfirmAction({ leadId: lead.id, status: "abgelehnt", name: lead.name })}
                        >
                          <XCircle className="h-4 w-4" /> Ablehnen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Tabelle */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Ansprechpartner</TableHead>
                        <TableHead>Kosten</TableHead>
                        <TableHead>Reklamiert am</TableHead>
                        <TableHead>Begründung</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offene.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <button
                              className="font-medium text-blue-600 hover:underline"
                              onClick={() => router.push(`/pipeline/${lead.id}`)}
                            >
                              {lead.name}
                            </button>
                          </TableCell>
                          <TableCell>{lead.ansprechpartner || "—"}</TableCell>
                          <TableCell>{lead.terminKosten ?? 320}€</TableCell>
                          <TableCell>
                            {lead.reklamiertAt
                              ? new Date(lead.reklamiertAt).toLocaleDateString("de-DE")
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <NotizCell lead={lead} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => setConfirmAction({ leadId: lead.id, status: "genehmigt", name: lead.name })}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Genehmigung erhalten
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-destructive"
                                onClick={() => setConfirmAction({ leadId: lead.id, status: "abgelehnt", name: lead.name })}
                              >
                                <XCircle className="h-4 w-4" /> Ablehnen
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Erledigte Reklamationen */}
        {erledigte.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Erledigte Reklamationen
                <Badge variant="secondary">{erledigte.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile: Karten-Ansicht */}
              <div className="md:hidden space-y-3">
                {erledigte.map((lead) => {
                  const cfg = statusConfig[lead.reklamationStatus || "offen"];
                  return (
                    <div key={lead.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            className="font-medium text-blue-600 hover:underline text-sm"
                            onClick={() => router.push(`/pipeline/${lead.id}`)}
                          >
                            {lead.name}
                          </button>
                          {lead.ansprechpartner && (
                            <p className="text-xs text-muted-foreground">{lead.ansprechpartner}</p>
                          )}
                        </div>
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{lead.terminKosten ?? 0}€</span>
                        <span>Reklamiert: {lead.reklamiertAt ? new Date(lead.reklamiertAt).toLocaleDateString("de-DE") : "—"}</span>
                      </div>
                      <div className="text-xs">
                        <NotizCell lead={lead} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: Tabelle */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Ansprechpartner</TableHead>
                      <TableHead>Kosten</TableHead>
                      <TableHead>Reklamiert am</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Begründung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {erledigte.map((lead) => {
                      const cfg = statusConfig[lead.reklamationStatus || "offen"];
                      return (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <button
                              className="font-medium text-blue-600 hover:underline"
                              onClick={() => router.push(`/pipeline/${lead.id}`)}
                            >
                              {lead.name}
                            </button>
                          </TableCell>
                          <TableCell>{lead.ansprechpartner || "—"}</TableCell>
                          <TableCell>{lead.terminKosten ?? 0}€</TableCell>
                          <TableCell>
                            {lead.reklamiertAt
                              ? new Date(lead.reklamiertAt).toLocaleDateString("de-DE")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={cfg.color}>{cfg.label}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <NotizCell lead={lead} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.status === "genehmigt" ? "Genehmigung durch VE erhalten?" : "Reklamation ablehnen?"}
        description={
          confirmAction?.status === "genehmigt"
            ? `Bestaetige, dass VersicherungsEngel die Reklamation fuer "${confirmAction.name}" genehmigt hat. Terminkosten werden auf 0€ gesetzt.`
            : `Die Kosten fuer "${confirmAction?.name}" bleiben bestehen.`
        }
        onConfirm={() => {
          if (confirmAction) handleStatusChange(confirmAction.leadId, confirmAction.status);
        }}
      />
    </>
  );
}
