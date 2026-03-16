"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Combobox } from "@/components/ui/combobox";
import { Search, AlertTriangle, Plus, Edit2, Trash2, FileText } from "lucide-react";

interface Insurance {
  id: number;
  bezeichnung: string;
  leadId: number | null;
  leadName: string | null;
  sparte: string | null;
  versicherer: string | null;
  beitrag: number | null;
  zahlweise: string | null;
  ablauf: string | null;
  umfang: string | null;
  notizen: string | null;
  produkt: string | null;
}

interface LeadOption {
  id: number;
  name: string;
}

const SPARTEN = [
  "Haftpflicht", "Inhalt", "Cyber", "D&O", "Flotte",
  "Rechtsschutz", "bAV", "KV", "Sonstiges",
];

export default function VersicherungenPage() {
  const router = useRouter();
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | null>(null);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [produktOptionen, setProduktOptionen] = useState<string[]>([]);
  const [form, setForm] = useState({
    bezeichnung: "",
    versicherer: "",
    sparte: "",
    beitrag: "",
    ablauf: "",
    umfang: "",
    produkt: "",
    leadId: "",
  });

  const loadData = useCallback(async () => {
    const [insRes, leadsRes, produktRes] = await Promise.all([
      fetch("/api/insurances"),
      fetch("/api/leads"),
      fetch("/api/produkte?kategorie=fremdvertrag"),
    ]);
    if (insRes.ok) setInsurances(await insRes.json());
    if (leadsRes.ok) {
      const allLeads = await leadsRes.json();
      setLeads(allLeads.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));
    }
    if (produktRes.ok) {
      const produktList = await produktRes.json();
      setProduktOptionen(produktList.map((p: { name: string }) => p.name));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = insurances.filter((i) =>
    i.bezeichnung.toLowerCase().includes(search.toLowerCase()) ||
    (i.leadName || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.versicherer || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.sparte || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.produkt || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalBeitrag = filtered.reduce((sum, i) => sum + (i.beitrag || 0), 0);

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date).getTime() < Date.now();
  };

  function openNew() {
    setEditingInsurance(null);
    setForm({ bezeichnung: "", versicherer: "", sparte: "", beitrag: "", ablauf: "", umfang: "", produkt: "", leadId: "" });
    setDialogOpen(true);
  }

  function openEdit(ins: Insurance) {
    setEditingInsurance(ins);
    setForm({
      bezeichnung: ins.bezeichnung,
      versicherer: ins.versicherer || "",
      sparte: ins.sparte || "",
      beitrag: ins.beitrag ? String(ins.beitrag) : "",
      ablauf: ins.ablauf || "",
      umfang: ins.umfang || "",
      produkt: ins.produkt || "",
      leadId: ins.leadId ? String(ins.leadId) : "",
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

  async function handleSave() {
    const payload = {
      bezeichnung: form.bezeichnung,
      versicherer: form.versicherer || null,
      sparte: form.sparte || null,
      beitrag: form.beitrag ? parseFloat(form.beitrag) : null,
      ablauf: form.ablauf || null,
      umfang: form.umfang || null,
      produkt: form.produkt || null,
      leadId: form.leadId ? Number(form.leadId) : null,
    };

    if (editingInsurance) {
      await fetch("/api/insurances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingInsurance.id, ...payload }),
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

  return (
    <div className="flex flex-col">
      <Header title="Versicherungen" />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suchen nach Bezeichnung, Lead, Versicherer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "Vertrag" : "Verträge"}
            {totalBeitrag > 0 && (
              <> · Gesamt: {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(totalBeitrag)} / Jahr</>
            )}
          </p>
          <Button onClick={openNew} className="gap-2 bg-[#003781] hover:bg-[#002a63] ml-auto">
            <Plus className="h-4 w-4" /> Neuer Vertrag
          </Button>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Sparte</TableHead>
                <TableHead>Versicherer</TableHead>
                <TableHead>Beitrag</TableHead>
                <TableHead>Ablauf</TableHead>
                <TableHead>Deckung</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Keine Fremdverträge erfasst</p>
                    <p className="text-xs mt-1">Erfasse Fremdverträge über &quot;Neuer Vertrag&quot;</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ins) => (
                  <TableRow
                    key={ins.id}
                    className={`${isExpired(ins.ablauf) ? "bg-red-50" : isExpiringSoon(ins.ablauf) ? "bg-amber-50" : ""}`}
                  >
                    <TableCell className="font-medium">{ins.bezeichnung}</TableCell>
                    <TableCell>{ins.produkt || "—"}</TableCell>
                    <TableCell>
                      {ins.leadName ? (
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-secondary/80"
                          onClick={() => ins.leadId && router.push(`/pipeline/${ins.leadId}`)}
                        >
                          {ins.leadName}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {ins.sparte && <Badge variant="outline">{ins.sparte}</Badge>}
                    </TableCell>
                    <TableCell>{ins.versicherer || "—"}</TableCell>
                    <TableCell>
                      {ins.beitrag
                        ? new Intl.NumberFormat("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          }).format(ins.beitrag)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {ins.ablauf
                          ? new Date(ins.ablauf).toLocaleDateString("de-DE")
                          : "—"}
                        {isExpiringSoon(ins.ablauf) && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        {isExpired(ins.ablauf) && (
                          <Badge variant="destructive" className="text-xs ml-1">Abgelaufen</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ins.umfang || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(ins)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(ins.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog for creating/editing Fremdvertrag */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInsurance ? "Vertrag bearbeiten" : "Neuer Fremdvertrag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Lead-Auswahl — Pflichtfeld */}
            <div>
              <Label>Lead *</Label>
              <Select value={form.leadId} onValueChange={(v) => setForm({ ...form, leadId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Lead zuordnen..." />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={String(lead.id)}>{lead.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Button onClick={handleSave} disabled={!form.bezeichnung || !form.leadId}>
                {editingInsurance ? "Speichern" : "Vertrag anlegen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
