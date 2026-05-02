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
import { SpeechInput } from "@/components/ui/speech-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead } from "@/app/(app)/pipeline/page";
import { isProviderPaused } from "@/lib/provider-pause";

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSave: (data: Partial<Lead>) => void;
}

interface LeadProvider {
  id: number;
  name: string;
  pausedUntil?: string | null;
}

function formatPauseDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

interface LeadProduct {
  id: number;
  name: string;
  active: boolean;
}

interface AppUser {
  id: number;
  name: string;
}

const LEAD_TYPEN = ["Gewerbe", "Privat"];
const GEWERBEARTEN = ["hauptberuflich", "nebenberuflich"];
const FOLGETERMIN_TYPEN = ["Nachfassen", "Cross-Selling", "Beratung", "Angebot nachfassen", "Sonstiges"];

const BRANCHEN = [
  "Bau", "Handwerk", "Dienstleistung", "Produktion", "IT",
  "Gesundheit", "Logistik", "Handel", "Gastronomie", "Immobilien", "Sonstiges",
];

const UNTERNEHMENSGROESSEN = ["1–9", "10–49", "50–199", "200–999", "1000+"];
const UMSATZKLASSEN = ["<1 Mio", "1–5 Mio", "5–20 Mio", "20–100 Mio", ">100 Mio"];

export function LeadDialog({ open, onOpenChange, lead, onSave }: LeadDialogProps) {
  const [providers, setProviders] = useState<LeadProvider[]>([]);
  const [products, setProducts] = useState<LeadProduct[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState({
    name: "",
    ansprechpartner: "",
    email: "",
    telefon: "",
    strasse: "",
    plz: "",
    ort: "",
    gewerbeart: "",
    leadTyp: "",
    branche: "",
    unternehmensgroesse: "",
    umsatzklasse: "",
    termin: "",
    folgetermin: "",
    folgeterminTyp: "",
    eingangsdatum: new Date().toISOString().split("T")[0],
    terminKosten: "320",
    naechsterSchritt: "",
    notizen: "",
    providerId: "",
    assignedTo: "",
    productId: "",
  });

  // Aktive Lead-Provider laden
  useEffect(() => {
    fetch("/api/lead-providers/active")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProviders(data))
      .catch(() => setProviders([]));
    fetch("/api/lead-products?active=true")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProducts(data))
      .catch(() => setProducts([]));
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : data.users || []))
      .catch(() => setUsers([]));
  }, [open]);

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name || "",
        ansprechpartner: lead.ansprechpartner || "",
        email: lead.email || "",
        telefon: lead.telefon || "",
        strasse: lead.strasse || "",
        plz: lead.plz || "",
        ort: lead.ort || "",
        gewerbeart: lead.gewerbeart || "",
        leadTyp: (lead as Lead & { leadTyp?: string }).leadTyp || "",
        branche: lead.branche || "",
        unternehmensgroesse: lead.unternehmensgroesse || "",
        umsatzklasse: lead.umsatzklasse || "",
        termin: lead.termin || "",
        folgetermin: lead.folgetermin || "",
        folgeterminTyp: lead.folgeterminTyp || "",
        eingangsdatum: lead.eingangsdatum ? lead.eingangsdatum.split("T")[0] : "",
        terminKosten: String(lead.terminKosten ?? 320),
        naechsterSchritt: lead.naechsterSchritt || "",
        notizen: lead.notizen || "",
        providerId: lead.providerId ? String(lead.providerId) : "",
        assignedTo: lead.assignedTo ? String(lead.assignedTo) : "",
        productId: lead.productId ? String(lead.productId) : "",
      });
    } else {
      setForm({
        name: "", ansprechpartner: "", email: "", telefon: "",
        strasse: "", plz: "", ort: "",
        gewerbeart: "", leadTyp: "", branche: "", unternehmensgroesse: "", umsatzklasse: "",
        termin: "", folgetermin: "", folgeterminTyp: "",
        eingangsdatum: new Date().toISOString().split("T")[0],
        terminKosten: "320",
        naechsterSchritt: "", notizen: "",
        providerId: "",
        assignedTo: "",
        productId: "",
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
      strasse: form.strasse || null,
      plz: form.plz || null,
      ort: form.ort || null,
      gewerbeart: form.gewerbeart || null,
      branche: form.branche || null,
      unternehmensgroesse: form.unternehmensgroesse || null,
      umsatzklasse: form.umsatzklasse || null,
      termin: form.termin || null,
      folgetermin: form.folgetermin || null,
      folgeterminTyp: form.folgeterminTyp || null,
      eingangsdatum: form.eingangsdatum || null,
      terminKosten: form.terminKosten ? Number(form.terminKosten) : 320,
      naechsterSchritt: form.naechsterSchritt || null,
      notizen: form.notizen || null,
      providerId: form.providerId ? Number(form.providerId) : null,
      assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
      productId: form.productId ? Number(form.productId) : null,
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
            {users.length > 0 && (
              <div className="space-y-2">
                <Label>Bearbeiter</Label>
                <Select
                  value={form.assignedTo}
                  onValueChange={(v) => setForm({ ...form, assignedTo: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Nicht zugewiesen" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Lead-Produkt</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) => setForm({ ...form, productId: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Kein Produkt" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {providers.length > 0 && (
            <div className="space-y-2">
              <Label>Anbieter</Label>
              <Select
                value={form.providerId}
                onValueChange={(v) => setForm({ ...form, providerId: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="Kein Anbieter" /></SelectTrigger>
                <SelectContent>
                  {providers.map((p) => {
                    const paused = isProviderPaused(p.pausedUntil);
                    return (
                      <SelectItem key={p.id} value={String(p.id)} disabled={paused}>
                        {p.name}
                        {paused && p.pausedUntil ? ` (pausiert bis ${formatPauseDate(p.pausedUntil)})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Straße + Hausnummer</Label>
              <Input
                value={form.strasse}
                onChange={(e) => setForm({ ...form, strasse: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>PLZ</Label>
              <Input
                value={form.plz}
                onChange={(e) => setForm({ ...form, plz: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ort</Label>
              <Input
                value={form.ort}
                onChange={(e) => setForm({ ...form, ort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Lead-Typ</Label>
              <Select
                value={form.leadTyp}
                onValueChange={(v) => setForm({ ...form, leadTyp: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                <SelectContent>
                  {LEAD_TYPEN.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                type="datetime-local"
                value={form.termin}
                onChange={(e) => setForm({ ...form, termin: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium">Folgetermin</Label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={form.folgetermin}
                  onChange={(e) => setForm({ ...form, folgetermin: e.target.value })}
                  className="flex-1"
                />
                <Select
                  value={form.folgeterminTyp}
                  onValueChange={(v) => setForm({ ...form, folgeterminTyp: v ?? "" })}
                >
                  <SelectTrigger className="w-44"><SelectValue placeholder="Typ waehlen" /></SelectTrigger>
                  <SelectContent>
                    {FOLGETERMIN_TYPEN.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Termin-Kosten (€)</Label>
              <Input
                type="number"
                value={form.terminKosten}
                onChange={(e) => setForm({ ...form, terminKosten: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Naechster Schritt</Label>
              <SpeechInput onTranscript={(t) => setForm((f) => ({ ...f, naechsterSchritt: f.naechsterSchritt ? f.naechsterSchritt + " " + t : t }))} />
            </div>
            <Input
              value={form.naechsterSchritt}
              onChange={(e) => setForm({ ...form, naechsterSchritt: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Notizen</Label>
              <SpeechInput onTranscript={(t) => setForm((f) => ({ ...f, notizen: f.notizen ? f.notizen + " " + t : t }))} />
            </div>
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
            <Button type="submit" className="bg-primary hover:bg-primary/90">
              {lead ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
