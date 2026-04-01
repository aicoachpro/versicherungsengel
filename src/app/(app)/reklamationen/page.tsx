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
import { CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

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
  genehmigt: { label: "Genehmigt", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  abgelehnt: { label: "Abgelehnt", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function ReklamationenPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ leadId: number; status: string; name: string } | null>(null);

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
        ? "Reklamation genehmigt — Terminkosten gutgeschrieben"
        : "Reklamation abgelehnt — Kosten bleiben bestehen");
      loadData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Fehler");
    }
    setConfirmAction(null);
  }

  const offene = leads.filter((l) => l.reklamationStatus === "offen");
  const erledigte = leads.filter((l) => l.reklamationStatus !== "offen");

  return (
    <>
      <Header title="Reklamationen" />
      <div className="p-6 space-y-6">
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
                      <TableCell>{lead.terminKosten || 320}€</TableCell>
                      <TableCell>
                        {lead.reklamiertAt
                          ? new Date(lead.reklamiertAt).toLocaleDateString("de-DE")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {lead.reklamationNotiz || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
                            onClick={() => setConfirmAction({ leadId: lead.id, status: "genehmigt", name: lead.name })}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Genehmigen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-red-600 border-red-300 hover:bg-red-50"
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
                        <TableCell className="max-w-xs truncate">
                          {lead.reklamationNotiz || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.status === "genehmigt" ? "Reklamation genehmigen?" : "Reklamation ablehnen?"}
        description={
          confirmAction?.status === "genehmigt"
            ? `Die Terminkosten für "${confirmAction.name}" werden auf 0€ gesetzt.`
            : `Die Kosten für "${confirmAction?.name}" bleiben bestehen.`
        }
        onConfirm={() => {
          if (confirmAction) handleStatusChange(confirmAction.leadId, confirmAction.status);
        }}
      />
    </>
  );
}
