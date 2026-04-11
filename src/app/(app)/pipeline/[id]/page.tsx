"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SpeechInput } from "@/components/ui/speech-input";
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
  Download,
  Upload,
  MessageSquare,
  Paperclip,
  Unlink,
  Clock,
  PhoneCall,
  MapPin,
  Linkedin,
  MoreHorizontal,
  Coins,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeadDialog } from "@/components/pipeline/lead-dialog";
import { toast } from "sonner";

interface Lead {
  id: number;
  name: string;
  phase: string;
  ansprechpartner: string | null;
  email: string | null;
  telefon: string | null;
  website: string | null;
  superchatContactId: string | null;
  gewerbeart: string | null;
  branche: string | null;
  unternehmensgroesse: string | null;
  umsatzklasse: string | null;
  termin: string | null;
  eingangsdatum: string | null;
  terminKosten: number | null;
  umsatz: number | null;
  conversion: number | null;
  naechsterSchritt: string | null;
  notizen: string | null;
  crossSelling: string | null;
  folgetermin: string | null;
  folgeterminNotified: number;
  reklamiertAt: string | null;
  reklamationStatus: string | null;
  reklamationNotiz: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

interface Activity {
  id: number;
  leadId: number;
  datum: string;
  kontaktart: string;
  notiz: string | null;
  createdAt: string;
}

interface Document {
  id: number;
  leadId: number;
  name: string;
  dateipfad: string;
  typ: string;
  createdAt: string;
}

interface Provision {
  id: number;
  importId: number;
  buchungsDatum: string;
  versNehmer: string;
  bsz: string | null;
  versNummer: string | null;
  datevKonto: string | null;
  kontoName: string | null;
  buchungstext: string | null;
  erfolgsDatum: string | null;
  vtnr: string | null;
  provBasis: number;
  provSatz: number;
  betrag: number;
  leadId: number | null;
  matchConfidence: number | null;
  confirmed: boolean;
  createdAt: string;
}

// DATEV-Konto Klassifizierung
const ABSCHLUSS_KONTEN = ["8011", "8021", "8031", "8041", "8051", "8061", "8091"];
const FOLGE_KONTEN = ["8012", "8022", "8032", "8042", "8052", "8062", "8072", "8092"];

function getProvTyp(datevKonto: string | null): "abschluss" | "folge" | "sonstige" {
  if (!datevKonto) return "sonstige";
  if (ABSCHLUSS_KONTEN.includes(datevKonto)) return "abschluss";
  if (FOLGE_KONTEN.includes(datevKonto)) return "folge";
  return "sonstige";
}

const SPARTEN = [
  "Haftpflicht", "Inhalt", "Cyber", "D&O", "Flotte",
  "Rechtsschutz", "bAV", "KV", "Sonstiges",
];

const KONTAKTARTEN = [
  "Telefon", "E-Mail", "WhatsApp", "Vor-Ort", "Onlinetermin", "LinkedIn", "Sonstiges",
];

const DOKUMENT_TYPEN = ["Angebot", "Police", "Beratungsprotokoll", "Gesprächsleitfaden", "E-Mail", "Sonstiges"];

const phaseColors: Record<string, string> = {
  "Termin eingegangen": "bg-blue-100 text-blue-800",
  "Termin stattgefunden": "bg-sky-100 text-sky-800",
  "Follow-up": "bg-amber-100 text-amber-800",
  "Angebot erstellt": "bg-purple-100 text-purple-800",
  "Abgeschlossen": "bg-emerald-100 text-emerald-800",
  "Verloren": "bg-red-100 text-red-800",
};

const kontaktartIcons: Record<string, string> = {
  "Telefon": "📞",
  "E-Mail": "📧",
  "WhatsApp": "💬",
  "Vor-Ort": "🏢",
  "Onlinetermin": "🖥️",
  "LinkedIn": "💼",
  "Sonstiges": "📝",
};

const kontaktartColors: Record<string, { dot: string; bg: string; text: string; icon: typeof PhoneCall }> = {
  "Telefon":   { dot: "bg-blue-500",   bg: "bg-blue-50",   text: "text-blue-700",   icon: PhoneCall },
  "E-Mail":    { dot: "bg-amber-500",  bg: "bg-amber-50",  text: "text-amber-700",  icon: Mail },
  "WhatsApp":  { dot: "bg-green-500",  bg: "bg-green-50",  text: "text-green-700",  icon: MessageSquare },
  "Vor-Ort":   { dot: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-700", icon: MapPin },
  "LinkedIn":  { dot: "bg-sky-500",    bg: "bg-sky-50",    text: "text-sky-700",    icon: Linkedin },
  "Sonstiges": { dot: "bg-gray-400",   bg: "bg-gray-50",   text: "text-gray-600",   icon: MoreHorizontal },
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffH < 24) return `vor ${diffH} Std.`;
  if (diffD === 0) return "heute";
  if (diffD === 1) return "gestern";
  if (diffD < 7) return `vor ${diffD} Tagen`;
  if (diffD < 30) {
    const weeks = Math.floor(diffD / 7);
    return `vor ${weeks} ${weeks === 1 ? "Woche" : "Wochen"}`;
  }
  if (diffD < 365) {
    const months = Math.floor(diffD / 30);
    return `vor ${months} ${months === 1 ? "Monat" : "Monaten"}`;
  }
  return new Date(dateStr).toLocaleDateString("de-DE");
}

const euroFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pctFormat = new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 2 });

function ProvisionenCard({ provisionen }: { provisionen: Provision[] }) {
  // Gruppierung nach Vertragsnummer
  const grouped = provisionen.reduce<Record<string, Provision[]>>((acc, p) => {
    const key = p.versNummer || "Ohne Vertragsnummer";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const contracts = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  // Zusammenfassung
  const totalBetrag = provisionen.reduce((s, p) => s + p.betrag, 0);
  const abschlussBetrag = provisionen
    .filter((p) => getProvTyp(p.datevKonto) === "abschluss")
    .reduce((s, p) => s + p.betrag, 0);
  const folgeBetrag = provisionen
    .filter((p) => getProvTyp(p.datevKonto) === "folge")
    .reduce((s, p) => s + p.betrag, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Provisionen</CardTitle>
          {provisionen.length > 0 && (
            <Badge variant="secondary" className="text-xs">{provisionen.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {provisionen.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Keine Provisionen zugeordnet</p>
            <p className="text-xs mt-1">Provisionen werden ueber den CSV-Import zugewiesen</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Zusammenfassung */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Gesamt-Provision</p>
                <p className={`text-lg font-bold ${totalBetrag >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {euroFormat.format(totalBetrag)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Vertraege</p>
                <p className="text-lg font-bold">{contracts.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Abschlussprovisionen</p>
                <p className={`text-lg font-bold ${abschlussBetrag >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {euroFormat.format(abschlussBetrag)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Folgeprovisionen</p>
                <p className={`text-lg font-bold ${folgeBetrag >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {euroFormat.format(folgeBetrag)}
                </p>
              </div>
            </div>

            {/* Vertraege */}
            <div className="space-y-3">
              {contracts.map(([versNr, items]) => {
                const subtotal = items.reduce((s, p) => s + p.betrag, 0);
                const kontoName = items[0]?.kontoName || "";
                return (
                  <div key={versNr} className="rounded-lg border">
                    {/* Vertrags-Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{versNr}</span>
                        {kontoName && (
                          <Badge variant="outline" className="text-xs">{kontoName}</Badge>
                        )}
                      </div>
                      <span className={`font-bold text-sm ${subtotal >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {euroFormat.format(subtotal)}
                      </span>
                    </div>
                    {/* Buchungszeilen */}
                    <div className="divide-y">
                      {items.map((p) => {
                        const typ = getProvTyp(p.datevKonto);
                        return (
                          <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                            <span className="text-muted-foreground w-20 flex-shrink-0">{p.buchungsDatum}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] flex-shrink-0 ${
                                typ === "abschluss" ? "border-blue-300 text-blue-700 bg-blue-50" :
                                typ === "folge" ? "border-amber-300 text-amber-700 bg-amber-50" :
                                ""
                              }`}
                            >
                              {p.datevKonto || "–"}
                            </Badge>
                            <span className="flex-1 min-w-0 truncate text-muted-foreground">
                              {p.buchungstext || "–"}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">
                              {euroFormat.format(p.provBasis)}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0 w-14 text-right">
                              {pctFormat.format(p.provSatz / 100)}
                            </span>
                            <span className={`font-medium flex-shrink-0 w-20 text-right ${p.betrag >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {euroFormat.format(p.betrag)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gesamtsumme */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/60 border">
              <span className="font-semibold text-sm">Gesamtsumme</span>
              <span className={`text-lg font-bold ${totalBetrag >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {euroFormat.format(totalBetrag)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = Number(params.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lead, setLead] = useState<Lead | null>(null);
  const [vertraege, setVertraege] = useState<Fremdvertrag[]>([]);
  const [aktivitaeten, setAktivitaeten] = useState<Activity[]>([]);
  const [dokumente, setDokumente] = useState<Document[]>([]);
  const [provisionen, setProvisionen] = useState<Provision[]>([]);
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

  // Aktivität-Dialog State
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    datum: new Date().toISOString().slice(0, 16),
    kontaktart: "Telefon",
    notiz: "",
  });

  // Dokument-Upload State
  const [uploadTyp, setUploadTyp] = useState("Sonstiges");

  // Lead-Edit Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Confirm-Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<{type: string, id: number, label: string} | null>(null);

  // Superchat State
  const [superchatSyncing, setSuperchatSyncing] = useState(false);

  // Reklamation State
  const [reklamationDialogOpen, setReklamationDialogOpen] = useState(false);
  const [reklamationNotiz, setReklamationNotiz] = useState("");
  const [reklamationLoading, setReklamationLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [leadId]);

  async function loadData() {
    setLoading(true);
    try {
      const safeFetch = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
      };

      const [allLeads, vertragData, produktList, csList, activityData, docData, provData] = await Promise.all([
        safeFetch("/api/leads"),
        safeFetch(`/api/insurances?leadId=${leadId}`),
        safeFetch("/api/produkte?kategorie=fremdvertrag"),
        safeFetch("/api/produkte?kategorie=cross_selling"),
        safeFetch(`/api/activities?leadId=${leadId}`),
        safeFetch(`/api/documents?leadId=${leadId}`),
        safeFetch(`/api/provisions?leadId=${leadId}&confirmed=true`),
      ]);

      const foundLead = (allLeads || []).find((l: Lead) => l.id === leadId);
      setLead(foundLead || null);
      setVertraege(vertragData || []);
      setAktivitaeten(activityData || []);
      setDokumente(docData || []);
      setProvisionen(provData || []);
      setProduktOptionen((produktList || []).map((p: { name: string }) => p.name));
      setCrossSellingOptionen((csList || []).map((p: { name: string }) => p.name));

      if (foundLead?.crossSelling) {
        try {
          setCrossSellingSelected(JSON.parse(foundLead.crossSelling));
        } catch {
          setCrossSellingSelected([]);
        }
      } else {
        setCrossSellingSelected([]);
      }
    } catch (err) {
      console.error("Lead-Detail laden fehlgeschlagen:", err);
      setLead(null);
    } finally {
      setLoading(false);
    }
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

  async function handleDeleteVertrag(id: number) {
    await fetch(`/api/insurances?id=${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    loadData();
  }

  // Aktivitäten
  async function handleSaveActivity() {
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        datum: activityForm.datum,
        kontaktart: activityForm.kontaktart,
        notiz: activityForm.notiz || null,
      }),
    });
    setActivityDialogOpen(false);
    setActivityForm({ datum: new Date().toISOString().slice(0, 16), kontaktart: "Telefon", notiz: "" });
    loadData();
  }

  async function handleDeleteActivity(id: number) {
    await fetch(`/api/activities?id=${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    loadData();
  }

  // Dokumente
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("leadId", String(leadId));
    formData.append("typ", uploadTyp);

    await fetch("/api/documents", { method: "POST", body: formData });
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadData();
  }

  async function handleDeleteDocument(id: number) {
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    loadData();
  }

  // Lead bearbeiten
  async function handleLeadSave(data: Partial<Lead>) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, ...data }),
    });
    toast.success("Lead gespeichert");
    setEditDialogOpen(false);
    loadData();
  }

  // Superchat
  async function handleSyncToSuperchat() {
    setSuperchatSyncing(true);
    try {
      const res = await fetch("/api/superchat/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.action === "create" ? "Kontakt in Superchat angelegt" : "Superchat-Kontakt aktualisiert");
        loadData();
      } else {
        toast.error(data.error || "Superchat-Fehler");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setSuperchatSyncing(false);
  }

  async function handleUnlinkContact() {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, superchatContactId: null }),
    });
    toast.success("Superchat-Verknüpfung entfernt");
    loadData();
  }

  // Reklamation
  async function handleReklamation() {
    setReklamationLoading(true);
    try {
      const res = await fetch("/api/leads/reklamation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, notiz: reklamationNotiz }),
      });
      if (res.ok) {
        toast.success("Lead als reklamiert markiert");
        setReklamationDialogOpen(false);
        setReklamationNotiz("");
        loadData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Fehler");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setReklamationLoading(false);
  }

  // Export
  async function handleExport() {
    window.open(`/api/leads/export/${leadId}`, "_blank");
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
        {/* Back button + Export */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push("/pipeline")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Zurück zur Pipeline
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Übergabedokument
          </Button>
        </div>

        {/* Lead Info Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-xl">{lead.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={phaseColors[lead.phase]}>{lead.phase}</Badge>
                {(lead.telefon || lead.email) && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-medium text-secondary-foreground transition-all hover:bg-secondary/70 active:scale-[0.97] disabled:opacity-50"
                    onClick={handleSyncToSuperchat}
                    disabled={superchatSyncing}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {superchatSyncing
                      ? "Übertrage..."
                      : lead.superchatContactId
                        ? "Aktualisieren"
                        : "An Superchat"}
                  </button>
                )}
                {lead.telefon && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-medium text-secondary-foreground transition-all hover:bg-secondary/70 active:scale-[0.97]"
                    onClick={() => {
                      let phone = lead.telefon!.replace(/[^0-9]/g, "");
                      if (phone.startsWith("0")) phone = "49" + phone.slice(1);
                      window.open(`https://app.superchat.de/inbox/find/?wa=${phone}`, "_blank");
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Superchat
                  </button>
                )}
                {!lead.reklamiertAt && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-[13px] font-medium text-destructive transition-all hover:bg-destructive/15 active:scale-[0.97]"
                    onClick={() => setReklamationDialogOpen(true)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Reklamieren
                  </button>
                )}
                {lead.reklamiertAt && (
                  <Badge variant="destructive">
                    Reklamiert ({lead.reklamationStatus})
                  </Badge>
                )}
                <button
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97]"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Bearbeiten
                </button>
              </div>
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
              {lead.superchatContactId && (
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-600">Superchat verknüpft</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    onClick={handleUnlinkContact}
                  >
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {lead.folgetermin && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span>Folgetermin: {new Date(lead.folgetermin).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
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

        {/* Aktivitäten Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Aktivitäten</CardTitle>
                <Badge variant="secondary" className="text-xs">{aktivitaeten.length}</Badge>
              </div>
              <Button
                onClick={() => {
                  setActivityForm({ datum: new Date().toISOString().slice(0, 16), kontaktart: "Telefon", notiz: "" });
                  setActivityDialogOpen(true);
                }}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Neue Aktivität
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aktivitaeten.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Noch keine Aktivitäten erfasst</p>
                <p className="text-xs mt-1">Dokumentiere Telefonate, E-Mails und Meetings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {aktivitaeten.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <span className="text-lg mt-0.5">{kontaktartIcons[a.kontaktart] || "📝"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">{a.kontaktart}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {new Date(a.datum).toLocaleString("de-DE", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {a.notiz && <p className="text-sm mt-1 whitespace-pre-wrap">{a.notiz}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => setDeleteConfirm({ type: "activity", id: a.id, label: `Aktivität vom ${new Date(a.datum).toLocaleDateString("de-DE")}` })}
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(v)} aria-label="Bearbeiten">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteConfirm({ type: "vertrag", id: v.id, label: v.bezeichnung })} aria-label="Löschen">
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

        {/* Dokumente Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Dokumente</CardTitle>
                <Badge variant="secondary" className="text-xs">{dokumente.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={uploadTyp} onValueChange={(v) => { if (v) setUploadTyp(v); }}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOKUMENT_TYPEN.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> Hochladen
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dokumente.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Noch keine Dokumente hochgeladen</p>
                <p className="text-xs mt-1">Lade Angebote, Policen oder E-Mails hoch</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dokumente.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg border">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{d.typ}</Badge>
                        <span>{new Date(d.createdAt).toLocaleDateString("de-DE")}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(`/api/documents/download/${d.id}`, "_blank")}
                        aria-label="Herunterladen"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm({ type: "document", id: d.id, label: d.name })}
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aktivitäten-Verlauf Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Aktivitaeten-Verlauf</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {aktivitaeten.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Aktivitaeten erfasst</p>
              </div>
            ) : (
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
                <div className="space-y-4">
                  {[...aktivitaeten]
                    .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
                    .map((a) => {
                      const cfg = kontaktartColors[a.kontaktart] || kontaktartColors["Sonstiges"];
                      const IconComp = cfg.icon;
                      return (
                        <div key={a.id} className="relative flex gap-3 items-start">
                          {/* Dot */}
                          <div className={`absolute -left-6 top-1 h-[18px] w-[18px] rounded-full border-2 border-background ${cfg.dot} flex items-center justify-center`}>
                            <IconComp className="h-2.5 w-2.5 text-white" />
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                                {a.kontaktart}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {relativeTime(a.datum)}
                              </span>
                            </div>
                            {a.notiz && (
                              <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap leading-relaxed">
                                {a.notiz}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provisionen Card */}
        <ProvisionenCard provisionen={provisionen} />
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

      {/* Confirm Dialog for deletions */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={
          deleteConfirm?.type === "vertrag" ? `Vertrag "${deleteConfirm.label}" löschen?` :
          deleteConfirm?.type === "activity" ? `${deleteConfirm.label} löschen?` :
          deleteConfirm?.type === "document" ? `Dokument "${deleteConfirm?.label}" löschen?` :
          "Wirklich löschen?"
        }
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={() => {
          if (!deleteConfirm) return;
          if (deleteConfirm.type === "vertrag") handleDeleteVertrag(deleteConfirm.id);
          else if (deleteConfirm.type === "activity") handleDeleteActivity(deleteConfirm.id);
          else if (deleteConfirm.type === "document") handleDeleteDocument(deleteConfirm.id);
        }}
      />

      {/* Lead Edit Dialog */}
      <LeadDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        lead={lead as unknown as Parameters<typeof LeadDialog>[0]["lead"]}
        onSave={handleLeadSave}
      />

      {/* Reklamation Dialog */}
      <Dialog open={reklamationDialogOpen} onOpenChange={setReklamationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Lead reklamieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Der Lead wird als reklamiert markiert. Sobald VersicherungsEngel die Genehmigung erteilt, werden die Terminkosten ({lead.terminKosten || 320}€) gutgeschrieben.
            </p>
            <div>
              <div className="flex items-center gap-1">
                <Label>Begruendung (optional)</Label>
                <SpeechInput onTranscript={(t) => setReklamationNotiz((v) => v ? v + " " + t : t)} />
              </div>
              <Textarea
                value={reklamationNotiz}
                onChange={(e) => setReklamationNotiz(e.target.value)}
                placeholder="Grund der Reklamation..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReklamationDialogOpen(false)}>Abbrechen</Button>
              <Button
                variant="destructive"
                onClick={handleReklamation}
                disabled={reklamationLoading}
              >
                {reklamationLoading ? "Wird reklamiert..." : "Reklamieren"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for new Activity */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Aktivität</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Datum & Uhrzeit *</Label>
                <Input
                  type="datetime-local"
                  value={activityForm.datum}
                  onChange={(e) => setActivityForm({ ...activityForm, datum: e.target.value })}
                />
              </div>
              <div>
                <Label>Kontaktart *</Label>
                <Select
                  value={activityForm.kontaktart}
                  onValueChange={(v) => { if (v) setActivityForm({ ...activityForm, kontaktart: v }); }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KONTAKTARTEN.map((k) => (
                      <SelectItem key={k} value={k}>
                        {kontaktartIcons[k]} {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <Label>Notiz</Label>
                <SpeechInput onTranscript={(t) => setActivityForm((f) => ({ ...f, notiz: f.notiz ? f.notiz + " " + t : t }))} />
              </div>
              <Textarea
                value={activityForm.notiz}
                onChange={(e) => setActivityForm({ ...activityForm, notiz: e.target.value })}
                placeholder="Was wurde besprochen?"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSaveActivity} disabled={!activityForm.datum || !activityForm.kontaktart}>
                Aktivität speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
