"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Building2,
  User,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  FileText,
  ShoppingBag,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";

interface Lead {
  id: number;
  name: string;
  phase: string;
  ansprechpartner: string | null;
  email: string | null;
  telefon: string | null;
  branche: string | null;
  termin: string | null;
  eingangsdatum: string | null;
  terminKosten: number | null;
  umsatz: number | null;
  notizen: string | null;
  crossSelling: string | null;
}

interface Fremdvertrag {
  id: number;
  bezeichnung: string;
  versicherer: string | null;
  sparte: string | null;
  beitrag: number | null;
  ablauf: string | null;
  umfang: string | null;
  produkt: string | null;
  leadId: number | null;
}

const SPARTEN = [
  "Haftpflicht", "Inhalt", "Cyber", "D&O", "Flotte",
  "Rechtsschutz", "bAV", "KV", "Sonstiges",
];

const phaseColors: Record<string, string> = {
  "Termin eingegangen": "bg-blue-100 text-blue-800",
  "Termin stattgefunden": "bg-sky-100 text-sky-800",
  "Follow-up": "bg-amber-100 text-amber-800",
  "Angebot erstellt": "bg-purple-100 text-purple-800",
  "Abgeschlossen": "bg-emerald-100 text-emerald-800",
  "Verloren": "bg-red-100 text-red-800",
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = Number(params.id);

  const [lead, setLead] = useState<Lead | null>(null);
  const [vertraege, setVertraege] = useState<Fremdvertrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVertrag, setEditingVertrag] = useState<Fremdvertrag | null>(null);
  const [form, setForm] = useState({
    bezeichnung: "",
    versicherer: "",
    sparte: "",
    beitrag: "",
    ablauf: "",
    umfang: "",
    produkt: "",
  });
  const [produktOptionen, setProduktOptionen] = useState<string[]>([]);
  const [crossSellingOptionen, setCrossSellingOptionen] = useState<string[]>([]);
  const [crossSellingSelected, setCrossSellingSelected] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [leadId]);

  async function loadData() {
    setLoading(true);
    const [leadRes, vertragRes, produktRes, crossSellingRes] = await Promise.all([
      fetch("/api/leads"),
      fetch(`/api/insurances?leadId=${leadId}`),
      fetch("/api/produkte?kategorie=fremdvertrag"),
      fetch("/api/produkte?kategorie=cross_selling"),
    ]);
    const allLeads = await leadRes.json();
    const foundLead = allLeads.find((l: Lead) => l.id === leadId);
    setLead(foundLead || null);
    setVertraege(await vertragRes.json());

    const produktList = await produktRes.json();
    setProduktOptionen(produktList.map((p: { name: string }) => p.name));

    const csList = await crossSellingRes.json();
    setCrossSellingOptionen(csList.map((p: { name: string }) => p.name));

    // Parse existing cross-selling selection from lead
    if (foundLead?.crossSelling) {
      try {
        setCrossSellingSelected(JSON.parse(foundLead.crossSelling));
      } catch {
        setCrossSellingSelected([]);
      }
    } else {
      setCrossSellingSelected([]);
    }

    setLoading(false);
  }

  function openNew() {
    setEditingVertrag(null);
    setForm({ bezeichnung: "", versicherer: "", sparte: "", beitrag: "", ablauf: "", umfang: "", produkt: "" });
    setDialogOpen(true);
  }

  function openEdit(v: Fremdvertrag) {
    setEditingVertrag(v);
    setForm({
      bezeichnung: v.bezeichnung,
      versicherer: v.versicherer || "",
      sparte: v.sparte || "",
      beitrag: v.beitrag ? String(v.beitrag) : "",
      ablauf: v.ablauf || "",
      umfang: v.umfang || "",
      produkt: v.produkt || "",
    });
    setDialogOpen(true);
  }

  async function handleCreateProdukt(name: string) {
    await fetch("/api/produkte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kategorie: "fremdvertrag" }),
    });
    setProduktOptionen((prev) => [...prev, name].sort());
  }

  async function handleCreateCrossSelling(name: string) {
    await fetch("/api/produkte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kategorie: "cross_selling" }),
    });
    setCrossSellingOptionen((prev) => [...prev, name].sort());
  }

  async function handleCrossSellingChange(selected: string[]) {
    setCrossSellingSelected(selected);
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, crossSelling: JSON.stringify(selected) }),
    });
  }

  async function handleSave() {
    const payload = {
      bezeichnung: form.bezeichnung,
      versicherer: form.versicherer || null,
      sparte: form.sparte || null,
      beitrag: form.beitrag ? parseFloat(form.beitrag) : null,
      ablauf: form.ablauf || null,
      umfang: form.umfang || null,
      produkt: form.produkt || null,
      leadId,
    };

    if (editingVertrag) {
      await fetch("/api/insurances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingVertrag.id, ...payload }),
      });
    } else {
      await fetch("/api/insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/insurances?id=${id}`, { method: "DELETE" });
    loadData();
  }

  function isExpiringSoon(ablauf: string | null) {
    if (!ablauf) return false;
    const diff = new Date(ablauf).getTime() - Date.now();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  }

  function isExpired(ablauf: string | null) {
    if (!ablauf) return false;
    return new Date(ablauf).getTime() < Date.now();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Lead nicht gefunden</p>
        <Button variant="outline" onClick={() => router.push("/pipeline")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zur Pipeline
        </Button>
      </div>
    );
  }

  const totalBeitrag = vertraege.reduce((sum, v) => sum + (v.beitrag || 0), 0);

  return (
    <>
      <Header title="Lead Details" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.push("/pipeline")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Pipeline
        </Button>

        {/* Lead Info Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{lead.name}</CardTitle>
              <Badge className={phaseColors[lead.phase]}>{lead.phase}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lead.ansprechpartner && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.ansprechpartner}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.email}</span>
                </div>
              )}
              {lead.telefon && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.telefon}</span>
                </div>
              )}
              {lead.branche && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.branche}</span>
                </div>
              )}
              {lead.eingangsdatum && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Eingang: {new Date(lead.eingangsdatum).toLocaleDateString("de-DE")}</span>
                </div>
              )}
              {lead.termin && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Termin: {new Date(lead.termin).toLocaleDateString("de-DE")}</span>
                </div>
              )}
              {lead.notizen && (
                <div className="flex items-start gap-2 text-sm md:col-span-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">{lead.notizen}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cross-Selling Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Cross-Selling</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Zusätzlich verkaufte Allianz-Produkte
            </p>
          </CardHeader>
          <CardContent>
            <MultiSelect
              options={crossSellingOptionen}
              selected={crossSellingSelected}
              onChange={handleCrossSellingChange}
              onCreateNew={handleCreateCrossSelling}
              placeholder="Produkte auswählen..."
            />
          </CardContent>
        </Card>

        {/* Fremdverträge Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Fremdverträge</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {vertraege.length} {vertraege.length === 1 ? "Vertrag" : "Verträge"}
                  {totalBeitrag > 0 && (
                    <> · Gesamt: {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(totalBeitrag)} / Jahr</>
                  )}
                </p>
              </div>
              <Button onClick={openNew} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Neuer Vertrag
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {vertraege.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Noch keine Fremdverträge erfasst</p>
                <p className="text-xs mt-1">Erfasse die bestehenden Versicherungen dieses Leads</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Gesellschaft</TableHead>
                    <TableHead>Sparte</TableHead>
                    <TableHead>Beitrag</TableHead>
                    <TableHead>Ablaufdatum</TableHead>
                    <TableHead>Deckungsumfang</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vertraege.map((v) => (
                    <TableRow key={v.id} className={isExpired(v.ablauf) ? "bg-red-50" : isExpiringSoon(v.ablauf) ? "bg-amber-50" : ""}>
                      <TableCell className="font-medium">{v.bezeichnung}</TableCell>
                      <TableCell>{v.produkt || "–"}</TableCell>
                      <TableCell>{v.versicherer || "–"}</TableCell>
                      <TableCell>
                        {v.sparte && <Badge variant="outline">{v.sparte}</Badge>}
                      </TableCell>
                      <TableCell>
                        {v.beitrag
                          ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v.beitrag)
                          : "–"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {v.ablauf ? new Date(v.ablauf).toLocaleDateString("de-DE") : "–"}
                          {isExpiringSoon(v.ablauf) && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                          {isExpired(v.ablauf) && (
                            <Badge variant="destructive" className="text-xs ml-1">Abgelaufen</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.umfang || "–"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(v)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(v.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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
      </div>

      {/* Dialog for creating/editing Fremdvertrag */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVertrag ? "Vertrag bearbeiten" : "Neuer Fremdvertrag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Bezeichnung *</Label>
              <Input
                value={form.bezeichnung}
                onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })}
                placeholder="z.B. Betriebshaftpflicht"
              />
            </div>
            <div>
              <Label>Gesellschaft</Label>
              <Input
                value={form.versicherer}
                onChange={(e) => setForm({ ...form, versicherer: e.target.value })}
                placeholder="z.B. HUK, DEVK, AXA..."
              />
            </div>
            <div>
              <Label>Produkt</Label>
              <Combobox
                options={produktOptionen}
                value={form.produkt}
                onChange={(v) => setForm({ ...form, produkt: v })}
                onCreateNew={handleCreateProdukt}
                placeholder="Produkt auswählen oder anlegen..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sparte</Label>
                <Select value={form.sparte || ""} onValueChange={(v) => setForm({ ...form, sparte: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SPARTEN.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Beitrag (€/Jahr)</Label>
                <Input
                  type="number"
                  value={form.beitrag}
                  onChange={(e) => setForm({ ...form, beitrag: e.target.value })}
                  placeholder="z.B. 1200"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ablaufdatum</Label>
                <Input
                  type="date"
                  value={form.ablauf}
                  onChange={(e) => setForm({ ...form, ablauf: e.target.value })}
                />
              </div>
              <div>
                <Label>Deckungsumfang</Label>
                <Input
                  value={form.umfang}
                  onChange={(e) => setForm({ ...form, umfang: e.target.value })}
                  placeholder="z.B. 5 Mio pauschal"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={!form.bezeichnung}>
                {editingVertrag ? "Speichern" : "Vertrag anlegen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
