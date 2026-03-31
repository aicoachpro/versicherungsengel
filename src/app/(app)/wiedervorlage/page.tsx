"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Clock,
  Phone,
  CalendarPlus,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: number;
  name: string;
  phase: string;
  ansprechpartner: string | null;
  branche: string | null;
  termin: string | null;
  folgetermin: string | null;
  folgeterminTyp: string | null;
  naechsterSchritt: string | null;
  updatedAt: string;
  archivedAt: string | null;
}

interface Activity {
  id: number;
  leadId: number;
  datum: string;
  kontaktart: string;
}

interface WiedervorlageItem {
  lead: Lead;
  reason: string;
  urgency: "high" | "medium" | "low";
  lastActivity: string | null;
  daysSinceActivity: number | null;
}

const KONTAKTARTEN = ["Telefon", "E-Mail", "WhatsApp", "Vor-Ort", "LinkedIn", "Sonstiges"];

export default function WiedervorlagePage() {
  const router = useRouter();
  const [items, setItems] = useState<WiedervorlageItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-Action Dialog
  const [actionDialog, setActionDialog] = useState<{
    type: "activity" | "folgetermin";
    lead: Lead;
  } | null>(null);
  const [activityForm, setActivityForm] = useState({
    kontaktart: "Telefon",
    notiz: "",
  });
  const [folgeterminForm, setFolgeterminForm] = useState({
    datum: "",
    typ: "Nachfassen",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [leadsRes, activitiesRes] = await Promise.all([
      fetch("/api/leads"),
      fetch("/api/activities"),
    ]);
    if (!leadsRes.ok || !activitiesRes.ok) {
      setLoading(false);
      return;
    }
    const allLeads: Lead[] = await leadsRes.json();
    const allActivities: Activity[] = await activitiesRes.json();

    const now = new Date();
    const result: WiedervorlageItem[] = [];

    const activeLeads = allLeads.filter(
      (l) => !l.archivedAt && l.phase !== "Abgeschlossen" && l.phase !== "Verloren"
    );

    for (const lead of activeLeads) {
      const leadActivities = allActivities
        .filter((a) => a.leadId === lead.id)
        .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
      const lastActivity = leadActivities[0]?.datum || null;
      const daysSinceActivity = lastActivity
        ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Überfälliger Termin
      if (lead.termin && new Date(lead.termin) < now) {
        const daysSince = Math.floor((now.getTime() - new Date(lead.termin).getTime()) / (1000 * 60 * 60 * 24));
        if (!lastActivity || new Date(lastActivity) < new Date(lead.termin)) {
          result.push({
            lead,
            reason: `Termin vor ${daysSince} Tagen — keine Aktivität seitdem`,
            urgency: daysSince > 7 ? "high" : "medium",
            lastActivity,
            daysSinceActivity,
          });
          continue;
        }
      }

      // Überfälliger Folgetermin
      if (lead.folgetermin && new Date(lead.folgetermin) < now) {
        const daysSince = Math.floor((now.getTime() - new Date(lead.folgetermin).getTime()) / (1000 * 60 * 60 * 24));
        if (!lastActivity || new Date(lastActivity) < new Date(lead.folgetermin)) {
          result.push({
            lead,
            reason: `${lead.folgeterminTyp || "Folgetermin"} vor ${daysSince} Tagen überfällig`,
            urgency: daysSince > 7 ? "high" : "medium",
            lastActivity,
            daysSinceActivity,
          });
          continue;
        }
      }

      // Keine Aktivität seit > 7 Tagen
      if (daysSinceActivity !== null && daysSinceActivity > 7) {
        result.push({
          lead,
          reason: `Letzte Aktivität vor ${daysSinceActivity} Tagen`,
          urgency: daysSinceActivity > 14 ? "high" : "medium",
          lastActivity,
          daysSinceActivity,
        });
        continue;
      }

      // Noch nie kontaktiert
      if (daysSinceActivity === null) {
        const daysSinceCreated = Math.floor(
          (now.getTime() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCreated > 2) {
          result.push({
            lead,
            reason: "Noch keine Aktivität erfasst",
            urgency: daysSinceCreated > 7 ? "high" : "low",
            lastActivity: null,
            daysSinceActivity: null,
          });
        }
      }
    }

    // Sortieren: high → medium → low
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    setItems(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleQuickActivity() {
    if (!actionDialog) return;
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: actionDialog.lead.id,
        datum: new Date().toISOString().slice(0, 16),
        kontaktart: activityForm.kontaktart,
        notiz: activityForm.notiz || null,
      }),
    });
    toast.success(`Aktivität für ${actionDialog.lead.name} erfasst`);
    setActionDialog(null);
    setActivityForm({ kontaktart: "Telefon", notiz: "" });
    loadData();
  }

  async function handleQuickFolgetermin() {
    if (!actionDialog) return;
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: actionDialog.lead.id,
        folgetermin: folgeterminForm.datum,
        folgeterminTyp: folgeterminForm.typ,
      }),
    });
    toast.success(`Folgetermin für ${actionDialog.lead.name} gesetzt`);
    setActionDialog(null);
    setFolgeterminForm({ datum: "", typ: "Nachfassen" });
    loadData();
  }

  async function handleMarkDone(lead: Lead) {
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        datum: new Date().toISOString().slice(0, 16),
        kontaktart: "Sonstiges",
        notiz: "Wiedervorlage erledigt",
      }),
    });
    toast.success(`${lead.name} als erledigt markiert`);
    loadData();
  }

  const highCount = items.filter((i) => i.urgency === "high").length;
  const mediumCount = items.filter((i) => i.urgency === "medium").length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Wiedervorlage" />
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {/* Stats */}
        {!loading && items.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{items.length} Leads brauchen Aufmerksamkeit</span>
            {highCount > 0 && (
              <Badge variant="destructive">{highCount} dringend</Badge>
            )}
            {mediumCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800">{mediumCount} offen</Badge>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Laden...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
            <p className="text-lg font-medium">Alles erledigt!</p>
            <p className="text-sm mt-1">Keine Leads benötigen gerade Aufmerksamkeit</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.lead.id} className={
                item.urgency === "high"
                  ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                  : item.urgency === "medium"
                    ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10"
                    : ""
              }>
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                    item.urgency === "high" ? "bg-red-100 text-red-600" :
                    item.urgency === "medium" ? "bg-amber-100 text-amber-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {item.urgency === "high" ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{item.lead.name}</p>
                      <Badge variant="outline" className="text-xs">{item.lead.phase}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
                    {item.lead.ansprechpartner && (
                      <p className="text-xs text-muted-foreground">{item.lead.ansprechpartner}</p>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap sm:flex-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setActivityForm({ kontaktart: "Telefon", notiz: "" });
                        setActionDialog({ type: "activity", lead: item.lead });
                      }}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Aktivität
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setFolgeterminForm({ datum: "", typ: "Nachfassen" });
                        setActionDialog({ type: "folgetermin", lead: item.lead });
                      }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Termin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => handleMarkDone(item.lead)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Erledigt
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => router.push(`/pipeline/${item.lead.id}`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick-Action Dialog: Aktivität */}
      <Dialog open={actionDialog?.type === "activity"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <MessageSquare className="h-5 w-5 inline mr-2" />
              Aktivität für {actionDialog?.lead.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select
              value={activityForm.kontaktart}
              onValueChange={(v) => { if (v) setActivityForm({ ...activityForm, kontaktart: v }); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KONTAKTARTEN.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={activityForm.notiz}
              onChange={(e) => setActivityForm({ ...activityForm, notiz: e.target.value })}
              placeholder="Was wurde besprochen?"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionDialog(null)}>Abbrechen</Button>
              <Button onClick={handleQuickActivity}>Aktivität speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-Action Dialog: Folgetermin */}
      <Dialog open={actionDialog?.type === "folgetermin"} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <CalendarPlus className="h-5 w-5 inline mr-2" />
              Folgetermin für {actionDialog?.lead.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="datetime-local"
              value={folgeterminForm.datum}
              onChange={(e) => setFolgeterminForm({ ...folgeterminForm, datum: e.target.value })}
            />
            <Select
              value={folgeterminForm.typ}
              onValueChange={(v) => { if (v) setFolgeterminForm({ ...folgeterminForm, typ: v }); }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Nachfassen", "Cross-Selling", "Beratung", "Angebot nachfassen", "Sonstiges"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionDialog(null)}>Abbrechen</Button>
              <Button onClick={handleQuickFolgetermin} disabled={!folgeterminForm.datum}>
                Termin setzen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
