"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

interface DeliveryLead {
  id: number;
  name: string;
  ansprechpartner: string | null;
  phase: string;
  productName: string | null;
  reklamiert: boolean;
  reklamationStatus: "offen" | "genehmigt" | "abgelehnt" | null;
  reklamationNotiz: string | null;
  eingangsdatum: string | null;
}

interface DeliveryResponse {
  provider: { id: number; name: string; minPerMonth: number };
  month: string;
  stats: {
    total: number;
    netto: number;
    reklamiertGenehmigt: number;
    minPerMonth: number;
  };
  leads: DeliveryLead[];
}

interface LeadDeliveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: number;
  providerName: string;
  budget: number;
  initialMonth: string;
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Januar", "02": "Februar", "03": "März", "04": "April",
  "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
  "09": "September", "10": "Oktober", "11": "November", "12": "Dezember",
};

function formatMonth(raw: string): string {
  const [y, m] = raw.split("-");
  return `${MONTH_NAMES[m] || m} ${y}`;
}

function shiftMonth(key: string, direction: -1 | 1): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + direction, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function phaseBadgeClass(phase: string): string {
  switch (phase) {
    case "Abgeschlossen":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "Verloren":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "Angebot erstellt":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "Follow-up":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "Termin stattgefunden":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200";
  }
}

export function LeadDeliveryModal({
  open,
  onOpenChange,
  providerId,
  providerName,
  budget,
  initialMonth,
}: LeadDeliveryModalProps) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<DeliveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (open) setMonth(initialMonth);
  }, [open, initialMonth]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/lead-delivery?providerId=${providerId}&month=${month}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<DeliveryResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Fehler beim Laden");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, providerId, month]);

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(
        `/api/lead-delivery/pdf?providerId=${providerId}&month=${month}`,
      );
      if (!res.ok) throw new Error("PDF-Export fehlgeschlagen");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lead-Lieferung_${providerName.replace(/\s+/g, "_")}_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen");
    } finally {
      setPdfLoading(false);
    }
  };

  const netto = data?.stats.netto ?? 0;
  const reklamiert = data?.stats.reklamiertGenehmigt ?? 0;
  const minPerMonth = data?.stats.minPerMonth ?? budget;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl w-full">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg">{providerName}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Lead-Lieferungen pro Monat</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePdf}
              disabled={pdfLoading || loading}
              className="gap-2"
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[130px] text-center">
              <p className="text-sm font-semibold">{formatMonth(month)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tracking-tight">
              {netto} <span className="text-sm font-normal text-muted-foreground">von {minPerMonth} vertraglich</span>
            </p>
            {reklamiert > 0 && (
              <p className="text-[11px] text-muted-foreground">{reklamiert} reklamiert (genehmigt)</p>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Lade Leads…
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 py-6 text-center">{error}</p>
          ) : !data || data.leads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Keine Leads in diesem Monat.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 px-2 font-medium">Produkt</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 pl-2 font-medium">Hinweis</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead) => {
                  const storniert = lead.reklamationStatus === "genehmigt";
                  return (
                    <tr
                      key={lead.id}
                      className={`border-b last:border-0 ${storniert ? "opacity-60" : ""}`}
                    >
                      <td className="py-2 pr-2">
                        <p className="font-medium truncate max-w-[200px]">{lead.name}</p>
                        {lead.ansprechpartner && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {lead.ansprechpartner}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {lead.productName || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-2">
                        {storniert ? (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 hover:bg-red-100">
                            Storniert
                          </Badge>
                        ) : (
                          <Badge className={`${phaseBadgeClass(lead.phase)} hover:opacity-90`}>
                            {lead.phase}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pl-2 text-xs text-muted-foreground">
                        {storniert ? (
                          lead.reklamationNotiz || (
                            <span className="italic">Kein Grund angegeben</span>
                          )
                        ) : lead.reklamationStatus === "offen" ? (
                          <span className="text-amber-600">Reklamation offen</span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
