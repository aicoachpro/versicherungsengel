"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead } from "@/app/(app)/pipeline/page";

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (data: Partial<Lead>) => void;
}

const GEWERBEARTEN = ["hauptberuflich", "nebenberuflich"];

const BRANCHEN = [
  "Bau", "Handwerk", "Dienstleistung", "Produktion", "IT",
  "Gesundheit", "Logistik", "Handel", "Gastronomie", "Immobilien", "Sonstiges",
];

const UNTERNEHMENSGROESSEN = ["1–9", "10–49", "50–199", "200–999", "1000+"];
const UMSATZKLASSEN = ["<1 Mio", "1–5 Mio", "5–20 Mio", "20–100 Mio", ">100 Mio"];

export function LeadDialog({ open, onOpenChange, lead, onSave }: LeadDialogProps) {
  const [form, setForm] = useState({
    name: "",
    ansprechpartner: "",
    email: "",
    telefon: "",
    gewerbeart: "",
    branche: "",
    unternehmensgroesse: "",
    umsatzklasse: "",
    termin: "",
    folgetermin: "",
    eingangsdatum: new Date().toISOString().split("T")[0],
    terminKosten: "320",
    umsatz: "",
    naechsterSchritt: "",
    notizen: "",
  });

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name || "",
        ansprechpartner: lead.ansprechpartner || "",
        email: lead.email || "",
        telefon: lead.telefon || "",
        gewerbeart: lead.gewerbeart || "",
        branche: lead.branche || "",
        unternehmensgroesse: lead.unternehmensgroesse || "",
        umsatzklasse: lead.umsatzklasse || "",
        termin: lead.termin ? lead.termin.split("T")[0] : "",
        folgetermin: lead.folgetermin || "",
        eingangsdatum: lead.eingangsdatum ? lead.eingangsdatum.split("T")[0] : "",
        terminKosten: String(lead.terminKosten ?? 320),
        umsatz: lead.umsatz ? String(lead.umsatz) : "",
        naechsterSchritt: lead.naechsterSchritt || "",
        notizen: lead.notizen || "",
      });
    } else {
      setForm({
        name: "", ansprechpartner: "", email: "", telefon: "",
        gewerbeart: "", branche: "", unternehmensgroesse: "", umsatzklasse: "",
        termin: "", folgetermin: "", eingangsdatum: new Date().toISOString().split("T")[0],
        terminKosten: "320", umsatz: "",
        naechsterSchritt: "", notizen: "",
      });
    }
  }, [lead, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      ansprechpartner: form.ansprechpartner || null,
      email: form.email || null,
      telefon: form.telefon || null,
      gewerbeart: form.gewerbeart || null,
      branche: form.branche || null,
      unternehmensgroesse: form.unternehmensgroesse || null,
      umsatzklasse: form.umsatzklasse || null,
      termin: form.termin || null,
      folgetermin: form.folgetermin || null,
      eingangsdatum: form.eingangsdatum || null,
      terminKosten: form.terminKosten ? Number(form.terminKosten) : 320,
      umsatz: form.umsatz ? Number(form.umsatz) : null,
      naechsterSchritt: form.naechsterSchritt || null,
      notizen: form.notizen || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Lead bearbeiten" : "Neuer Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Firma / Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ansprechpartner</Label>
              <Input
                value={form.ansprechpartner}
                onChange={(e) => setForm({ ...form, ansprechpartner: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={form.telefon}
                onChange={(e) => setForm({ ...form, telefon: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gewerbeart</Label>
              <Select
                value={form.gewerbeart}
                onValueChange={(v) => setForm({ ...form, gewerbeart: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                <SelectContent>
                  {GEWERBEARTEN.map((g) => (
                    <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branche</Label>
              <Select
                value={form.branche}
                onValueChange={(v) => setForm({ ...form, branche: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                <SelectContent>
                  {BRANCHEN.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unternehmensgröße</Label>
              <Select
                value={form.unternehmensgroesse}
                onValueChange={(v) => setForm({ ...form, unternehmensgroesse: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                <SelectContent>
                  {UNTERNEHMENSGROESSEN.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Umsatzklasse</Label>
              <Select
                value={form.umsatzklasse}
                onValueChange={(v) => setForm({ ...form, umsatzklasse: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                <SelectContent>
                  {UMSATZKLASSEN.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Eingangsdatum *</Label>
              <Input
                type="date"
                value={form.eingangsdatum}
                onChange={(e) => setForm({ ...form, eingangsdatum: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Termin</Label>
              <Input
                type="date"
                value={form.termin}
                onChange={(e) => setForm({ ...form, termin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Folgetermin (Cross-Selling)</Label>
              <Input
                type="datetime-local"
                value={form.folgetermin}
                onChange={(e) => setForm({ ...form, folgetermin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Termin-Kosten (€)</Label>
              <Input
                type="number"
                value={form.terminKosten}
                onChange={(e) => setForm({ ...form, terminKosten: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Umsatz (€)</Label>
              <Input
                type="number"
                value={form.umsatz}
                onChange={(e) => setForm({ ...form, umsatz: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nächster Schritt</Label>
            <Input
              value={form.naechsterSchritt}
              onChange={(e) => setForm({ ...form, naechsterSchritt: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea
              value={form.notizen}
              onChange={(e) => setForm({ ...form, notizen: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" className="bg-[#003781] hover:bg-[#002a63]">
              {lead ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
