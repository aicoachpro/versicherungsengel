"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Shield,
  Key,
  Smartphone,
  Building2,
  BookOpen,
  Bell,
  Send,
  Mail,
  MessageSquare,
  Check,
  Loader2,
  Upload,
  Package,
  Pencil,
  Trash2,
  Plus,
  Brain,
  CircleCheck,
  CircleX,
  Inbox,
  Tag,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";

type SettingsMap = Record<string, string>;

interface SettingsField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
  options?: { value: string; label: string }[];
}

interface SettingsSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  fields: SettingsField[];
  settings: SettingsMap;
  onSave: (values: SettingsMap) => Promise<void>;
  footer?: React.ReactNode;
}

function isActive(fields: { key: string }[], settings: SettingsMap) {
  return fields.some((f) => {
    const val = settings[f.key];
    return val && val !== "" && val !== "***";
  });
}

function SettingsSection({ icon, title, description, fields, settings, onSave, footer }: SettingsSectionProps) {
  const [values, setValues] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const active = isActive(fields, settings);

  useEffect(() => {
    const v: SettingsMap = {};
    for (const f of fields) {
      v[f.key] = settings[f.key] || "";
    }
    setValues(v);
  }, [settings, fields]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await onSave(values);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Aktiv" : "Nicht konfiguriert"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label>{f.label}</Label>
            {f.options ? (
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={values[f.key] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <Input
                type={f.type || "text"}
                placeholder={f.placeholder}
                value={values[f.key] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                onFocus={(e) => {
                  // Clear masked values on focus so user can enter new value
                  const val = e.target.value;
                  if (val.includes("...") && val.length <= 10) {
                    setValues((prev) => ({ ...prev, [f.key]: "" }));
                  }
                }}
              />
            )}
          </div>
        ))}
        {footer}
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saving ? "Speichere…" : saved ? "Gespeichert" : "Speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface LeadProvider {
  id: number;
  name: string;
  leadType: string | null;
  minPerMonth: number;
  costPerLead: number;
  billingModel: string;
  carryOver: boolean;
  startMonth: string | null;
  active: boolean;
  products?: { id: number; name: string }[];
  productPrices?: Record<number, number | null>;
  createdAt: string;
  updatedAt: string;
}

type LeadProviderForm = {
  name: string;
  leadType: string;
  minPerMonth: number;
  costPerLead: number;
  billingModel: string;
  carryOver: string;
  startMonth: string;
  productIds: number[];
  productPrices: Record<number, number | null>;
};

const EMPTY_FORM: LeadProviderForm = {
  name: "",
  leadType: "",
  minPerMonth: 10,
  costPerLead: 320,
  billingModel: "prepaid",
  carryOver: "true",
  startMonth: "",
  productIds: [],
  productPrices: {},
};

interface ProviderProduct {
  id: number;
  name: string;
  kuerzel?: string | null;
  active: boolean;
}

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function LeadProviderDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
  providerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: LeadProviderForm;
  onSave: (data: LeadProviderForm) => Promise<void>;
  providerId?: number;
}) {
  const [form, setForm] = useState<LeadProviderForm>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [allProducts, setAllProducts] = useState<ProviderProduct[]>([]);
  const isEdit = initialData.name !== "";

  useEffect(() => {
    if (open) {
      setForm(initialData);
      setError("");
      fetch("/api/lead-products")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setAllProducts(data))
        .catch(() => setAllProducts([]));
    }
  }, [open, initialData]);

  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ matched: number; skipped: number; vatApplied?: boolean; results?: { sparte: string; matched: boolean }[] } | null>(null);
  const [pendingCsv, setPendingCsv] = useState<File | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const toggleProduct = (productId: number) => {
    setForm((prev) => {
      const ids = prev.productIds.includes(productId)
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId];
      return { ...prev, productIds: ids };
    });
  };

  const setProductPrice = (productId: number, price: string) => {
    setForm((prev) => ({
      ...prev,
      productPrices: {
        ...prev.productPrices,
        [productId]: price ? parseFloat(price) : null,
      },
    }));
  };

  const uploadCsv = async (file: File, priceType: "brutto" | "netto") => {
    if (!providerId) return;
    setCsvUploading(true);
    setCsvResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("priceType", priceType);
      const res = await fetch(`/api/lead-providers/${providerId}/prices`, { method: "POST", body: fd });
      const data = await res.json();
      setCsvResult(data);
      if (data.matched > 0) {
        // Reload products from API
        const provRes = await fetch(`/api/lead-providers`);
        if (provRes.ok) {
          const provs = await provRes.json();
          const prov = provs.find((p: LeadProvider) => p.id === providerId);
          if (prov) {
            setForm((prev) => ({
              ...prev,
              productIds: prov.productIds || [],
              productPrices: prov.productPrices || {},
            }));
          }
        }
      }
    } catch {
      setCsvResult({ matched: 0, skipped: 0 });
    } finally {
      setCsvUploading(false);
    }
  };

  const monthlyCost = (form.minPerMonth || 0) * (form.costPerLead || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Anbieter-Name ist erforderlich");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Anbieter bearbeiten" : "Anbieter hinzufügen"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ändere die Daten des Lead-Anbieters."
              : "Konfiguriere einen neuen Lead-Anbieter."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Anbieter-Name *</Label>
            <Input
              placeholder="z.B. WVD Versicherungsdienst"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Lead-Typ</Label>
            <Input
              placeholder="z.B. Gewerbe-Leads"
              value={form.leadType}
              onChange={(e) => setForm((p) => ({ ...p, leadType: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mindestabnahme / Monat</Label>
              <Input
                type="number"
                min={0}
                value={form.minPerMonth}
                onChange={(e) => setForm((p) => ({ ...p, minPerMonth: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Kosten pro Lead in EUR</Label>
              <Input
                type="number"
                min={0}
                value={form.costPerLead}
                onChange={(e) => setForm((p) => ({ ...p, costPerLead: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Abrechnungsmodell</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.billingModel}
                onChange={(e) => setForm((p) => ({ ...p, billingModel: e.target.value }))}
              >
                <option value="prepaid">Vorauszahlung</option>
                <option value="per-lead">Pay-per-Lead</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Guthaben-Übertrag</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.carryOver}
                onChange={(e) => setForm((p) => ({ ...p, carryOver: e.target.value }))}
              >
                <option value="true">Ja</option>
                <option value="false">Nein</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vertragsstart</Label>
            <Input
              type="month"
              value={form.startMonth}
              onChange={(e) => setForm((p) => ({ ...p, startMonth: e.target.value }))}
            />
          </div>
          {allProducts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lead-Produkte & Preise</Label>
                {providerId && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPendingCsv(file);
                          setCsvResult(null);
                        }
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                      <Upload className="h-3 w-3" />
                      {csvUploading ? "Lade..." : "CSV-Preisliste hochladen"}
                    </span>
                  </label>
                )}
              </div>
              {csvResult && (
                <p className={`text-xs ${csvResult.matched > 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {csvResult.matched} Sparten zugeordnet, {csvResult.skipped} uebersprungen
                  {csvResult.vatApplied && " (19% MwSt aufgeschlagen)"}
                </p>
              )}
              {/* Suchfeld + Filter-Toggle + Bulk-Aktionen */}
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  placeholder="Suche nach Name oder Kuerzel..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="h-8 text-xs flex-1 min-w-[180px]"
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer shrink-0 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showOnlyActive}
                    onChange={(e) => setShowOnlyActive(e.target.checked)}
                    className="rounded border-input"
                  />
                  Nur aktive ({form.productIds.length})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setForm((prev) => ({ ...prev, productIds: [], productPrices: {} }))}
                  disabled={form.productIds.length === 0}
                >
                  Alle abwaehlen
                </Button>
              </div>
              <div className="rounded-md border p-3 space-y-2 max-h-64 overflow-y-auto">
                {(() => {
                  const q = productSearch.toLowerCase().trim();
                  const filtered = allProducts
                    .filter((p) => p.active)
                    .filter((p) => !showOnlyActive || form.productIds.includes(p.id))
                    .filter((p) => {
                      if (!q) return true;
                      return (
                        p.name.toLowerCase().includes(q) ||
                        (p.kuerzel && p.kuerzel.toLowerCase().includes(q))
                      );
                    });
                  if (filtered.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {q ? "Keine Treffer" : showOnlyActive ? "Keine aktiven Produkte" : "Keine Produkte"}
                      </p>
                    );
                  }
                  return filtered.map((product) => {
                    const isChecked = form.productIds.includes(product.id);
                    return (
                      <div key={product.id} className="flex items-center gap-2 text-sm hover:bg-accent/50 rounded px-1 py-0.5">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleProduct(product.id)}
                            className="rounded border-input shrink-0"
                          />
                          <span className="truncate">
                            {product.kuerzel && (
                              <span className="text-[10px] text-muted-foreground font-mono mr-1">[{product.kuerzel}]</span>
                            )}
                            {product.name}
                          </span>
                        </label>
                        {isChecked && (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="EUR"
                            className="w-20 h-7 text-xs"
                            value={form.productPrices[product.id] ?? ""}
                            onChange={(e) => setProductPrice(product.id, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                Preis pro Sparte eingeben oder CSV hochladen. Ohne Preis gilt der Pauschalpreis.
              </p>
            </div>
          )}
          {monthlyCost > 0 && (
            <p className="text-sm text-muted-foreground">
              Monatliche Fixkosten: <span className="font-medium">{currencyFormat.format(monthlyCost)}</span>
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Speichere…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Brutto/Netto Dialog vor CSV-Upload (innerhalb des Dialogs damit Ref bleibt) */}
      {pendingCsv && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingCsv(null); }}
        >
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Preisliste hochladen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sind die Preise in <strong>{pendingCsv.name}</strong> Brutto oder Netto?
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Als Versicherungsvermittler bist du nicht vorsteuerabzugsberechtigt.
                Bei Netto-Preisen wird automatisch 19% Mehrwertsteuer aufgeschlagen.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={async () => {
                  const file = pendingCsv;
                  setPendingCsv(null);
                  await uploadCsv(file, "brutto");
                }}
                disabled={csvUploading}
                className="bg-primary hover:bg-primary/90"
              >
                Brutto-Preise (inkl. MwSt)
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const file = pendingCsv;
                  setPendingCsv(null);
                  await uploadCsv(file, "netto");
                }}
                disabled={csvUploading}
              >
                Netto-Preise (+ 19% MwSt aufschlagen)
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setPendingCsv(null)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function LeadProviderSection() {
  const [providers, setProviders] = useState<LeadProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<LeadProvider | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/lead-providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAdd = async (form: LeadProviderForm) => {
    const res = await fetch("/api/lead-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        leadType: form.leadType || null,
        minPerMonth: form.minPerMonth,
        costPerLead: form.costPerLead,
        billingModel: form.billingModel,
        carryOver: form.carryOver === "true",
        startMonth: form.startMonth || null,
        productIds: form.productIds,
        productPrices: form.productPrices,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Anlegen");
    }
    await fetchProviders();
    showFeedback("success", "Anbieter hinzugefuegt");
  };

  const handleEdit = async (form: LeadProviderForm) => {
    if (!editProvider) return;
    const res = await fetch(`/api/lead-providers/${editProvider.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        leadType: form.leadType || null,
        minPerMonth: form.minPerMonth,
        costPerLead: form.costPerLead,
        billingModel: form.billingModel,
        carryOver: form.carryOver === "true",
        startMonth: form.startMonth || null,
        productIds: form.productIds,
        productPrices: form.productPrices,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Speichern");
    }
    setEditProvider(null);
    await fetchProviders();
    showFeedback("success", "Anbieter aktualisiert");
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lead-providers/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showFeedback("error", data.error || "Fehler beim Löschen");
      } else {
        await fetchProviders();
        showFeedback("success", "Anbieter gelöscht");
      }
    } catch {
      showFeedback("error", "Verbindungsfehler");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const openEdit = (p: LeadProvider) => {
    setEditProvider(p);
  };

  const editFormData: LeadProviderForm = editProvider
    ? {
        name: editProvider.name,
        leadType: editProvider.leadType || "",
        minPerMonth: editProvider.minPerMonth,
        costPerLead: editProvider.costPerLead,
        billingModel: editProvider.billingModel,
        carryOver: editProvider.carryOver ? "true" : "false",
        startMonth: editProvider.startMonth || "",
        productIds: (editProvider as unknown as { productIds?: number[] }).productIds || editProvider.products?.map((p) => p.id) || [],
        productPrices: editProvider.productPrices || {},
      }
    : EMPTY_FORM;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Lead-Anbieter
            </h3>
            <Badge variant={providers.length > 0 ? "default" : "secondary"}>
              {providers.length > 0 ? `${providers.length} Anbieter` : "Nicht konfiguriert"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Verwalte deine Lead-Anbieter. Nicht gelieferte Leads können als Guthaben übertragen werden.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <p className={`text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
              {feedback.message}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Anbieter…
            </div>
          ) : providers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Noch kein Lead-Anbieter konfiguriert
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Anbieter hinzufügen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border p-4 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name}</span>
                      <Badge variant={p.active ? "default" : "secondary"} className="text-xs">
                        {p.active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.leadType && <span>{p.leadType}</span>}
                      <span>{p.minPerMonth} Leads/Monat</span>
                      <span>{currencyFormat.format(p.costPerLead)}/Lead</span>
                      <span>{p.billingModel === "prepaid" ? "Vorauszahlung" : "Pay-per-Lead"}</span>
                      {p.carryOver && <span>Guthaben-Übertrag</span>}
                    </div>
                    {p.products && p.products.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.products.map((prod) => (
                          <Badge key={prod.id} variant="outline" className="text-xs py-0 px-1.5">
                            {prod.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {p.minPerMonth > 0 && p.costPerLead > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Fixkosten: {currencyFormat.format(p.minPerMonth * p.costPerLead)}/Monat
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(p)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(p.id)}
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && providers.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Anbieter hinzufügen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <LeadProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={EMPTY_FORM}
        onSave={handleAdd}
      />

      {/* Edit dialog */}
      <LeadProviderDialog
        open={editProvider !== null}
        onOpenChange={(open) => { if (!open) setEditProvider(null); }}
        initialData={editFormData}
        onSave={handleEdit}
        providerId={editProvider?.id}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Anbieter löschen</DialogTitle>
            <DialogDescription>
              Soll der Anbieter &quot;{providers.find((p) => p.id === deleteId)?.name}&quot; wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Lösche…" : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Lead-Produkte Section ──────────────────────────────────────────────

interface LeadProduct {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

function LeadProductDialog({
  open,
  onOpenChange,
  initialName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = initialName !== "";

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError("");
    }
  }, [open, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Produktname ist erforderlich");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(name.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Produkt umbenennen" : "Produkt hinzufuegen"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Aendere den Produktnamen." : "Erstelle ein neues Lead-Produkt."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Produktname *</Label>
            <Input
              placeholder="z.B. Gewerbeversicherung"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LeadProductSection() {
  const [products, setProducts] = useState<LeadProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<LeadProduct | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/lead-products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAdd = async (name: string) => {
    const res = await fetch("/api/lead-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Anlegen");
    }
    await fetchProducts();
    showFeedback("success", "Produkt hinzugefuegt");
  };

  const handleEdit = async (name: string) => {
    if (!editProduct) return;
    const res = await fetch(`/api/lead-products/${editProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Speichern");
    }
    setEditProduct(null);
    await fetchProducts();
    showFeedback("success", "Produkt aktualisiert");
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lead-products/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showFeedback("error", data.error || "Fehler beim Loeschen");
      } else {
        await fetchProducts();
        showFeedback("success", "Produkt geloescht");
      }
    } catch {
      showFeedback("error", "Verbindungsfehler");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (product: LeadProduct) => {
    try {
      const res = await fetch(`/api/lead-products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      if (res.ok) {
        await fetchProducts();
        showFeedback("success", product.active ? "Produkt deaktiviert" : "Produkt aktiviert");
      }
    } catch {
      showFeedback("error", "Verbindungsfehler");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Lead-Produkte
            </h3>
            <Badge variant={products.length > 0 ? "default" : "secondary"}>
              {products.length > 0 ? `${products.length} Produkt${products.length > 1 ? "e" : ""}` : "Nicht konfiguriert"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Produkte, die deine Lead-Anbieter liefern. Koennen Leads und Anbietern zugeordnet werden.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <p className={`text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
              {feedback.message}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Produkte...
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Noch kein Lead-Produkt konfiguriert
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Produkt hinzufuegen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{p.name}</span>
                    <Badge
                      variant={p.active ? "default" : "secondary"}
                      className="text-xs cursor-pointer"
                      onClick={() => handleToggleActive(p)}
                      title={p.active ? "Klicken zum Deaktivieren" : "Klicken zum Aktivieren"}
                    >
                      {p.active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditProduct(p)}
                      title="Umbenennen"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(p.id)}
                      title="Loeschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && products.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Produkt hinzufuegen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <LeadProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName=""
        onSave={handleAdd}
      />

      {/* Edit dialog */}
      <LeadProductDialog
        open={editProduct !== null}
        onOpenChange={(open) => { if (!open) setEditProduct(null); }}
        initialName={editProduct?.name || ""}
        onSave={handleEdit}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Produkt loeschen</DialogTitle>
            <DialogDescription>
              Soll das Produkt &quot;{products.find((p) => p.id === deleteId)?.name}&quot; wirklich geloescht werden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Loesche..." : "Loeschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EmailAccount {
  id: number;
  name: string;
  imapHost: string;
  imapPort: number;
  useSsl: boolean;
  username: string;
  password: string;
  folder: string;
  providerId: number | null;
  active: boolean;
  lastPolledAt: string | null;
  createdAt: string;
}

type EmailAccountForm = {
  name: string;
  imapHost: string;
  imapPort: number;
  useSsl: string;
  username: string;
  password: string;
  folder: string;
  providerId: string;
};

const EMPTY_EMAIL_FORM: EmailAccountForm = {
  name: "",
  imapHost: "",
  imapPort: 993,
  useSsl: "true",
  username: "",
  password: "",
  folder: "INBOX",
  providerId: "",
};

function EmailAccountDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: EmailAccountForm;
  onSave: (data: EmailAccountForm) => Promise<void>;
}) {
  const [form, setForm] = useState<EmailAccountForm>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emailProviders, setEmailProviders] = useState<{ id: number; name: string }[]>([]);
  const isEdit = initialData.name !== "";

  useEffect(() => {
    if (open) {
      setForm(initialData);
      setError("");
      fetch("/api/lead-providers/active")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setEmailProviders(data))
        .catch(() => setEmailProviders([]));
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist erforderlich");
      return;
    }
    if (!form.imapHost.trim()) {
      setError("IMAP-Host ist erforderlich");
      return;
    }
    if (!form.username.trim()) {
      setError("Benutzername ist erforderlich");
      return;
    }
    if (!isEdit && !form.password.trim()) {
      setError("Passwort ist erforderlich");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "E-Mail-Konto bearbeiten" : "E-Mail-Konto hinzufuegen"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Aendere die IMAP-Zugangsdaten."
              : "Konfiguriere ein neues E-Mail-Konto fuer den Lead-Import."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Anzeigename *</Label>
            <Input
              placeholder="z.B. Lead-Postfach"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IMAP-Host *</Label>
              <Input
                placeholder="z.B. imap.gmail.com"
                value={form.imapHost}
                onChange={(e) => setForm((p) => ({ ...p, imapHost: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>IMAP-Port</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.imapPort}
                onChange={(e) => setForm((p) => ({ ...p, imapPort: parseInt(e.target.value) || 993 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SSL verwenden</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.useSsl}
              onChange={(e) => setForm((p) => ({ ...p, useSsl: e.target.value }))}
            >
              <option value="true">Ja (empfohlen)</option>
              <option value="false">Nein</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Benutzername / E-Mail *</Label>
            <Input
              placeholder="leads@firma.de"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Passwort *</Label>
            <Input
              type="password"
              placeholder={isEdit ? "Leer lassen = nicht aendern" : "IMAP-Passwort"}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required={!isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Ordner</Label>
            <Input
              placeholder="INBOX"
              value={form.folder}
              onChange={(e) => setForm((p) => ({ ...p, folder: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Lead-Anbieter</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.providerId}
              onChange={(e) => setForm((p) => ({ ...p, providerId: e.target.value }))}
            >
              <option value="">Kein Anbieter zugeordnet</option>
              {emailProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Ordne dieses Postfach einem Lead-Anbieter zu fuer automatische Bearbeiter-Zuweisung.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmailAccountSection() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<EmailAccount | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; error?: string }>>({});

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/email-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAdd = async (form: EmailAccountForm) => {
    const res = await fetch("/api/email-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        imapHost: form.imapHost,
        imapPort: form.imapPort,
        useSsl: form.useSsl === "true",
        username: form.username,
        password: form.password,
        folder: form.folder || "INBOX",
        providerId: form.providerId ? parseInt(form.providerId) : null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Anlegen");
    }
    await fetchAccounts();
    showFeedback("success", "E-Mail-Konto hinzugefuegt");
  };

  const handleEdit = async (form: EmailAccountForm) => {
    if (!editAccount) return;
    const payload: Record<string, unknown> = {
      name: form.name,
      imapHost: form.imapHost,
      imapPort: form.imapPort,
      useSsl: form.useSsl === "true",
      username: form.username,
      folder: form.folder || "INBOX",
      providerId: form.providerId ? parseInt(form.providerId) : null,
    };
    // Only send password if user entered a new one
    if (form.password && form.password !== "********") {
      payload.password = form.password;
    }
    const res = await fetch(`/api/email-accounts/${editAccount.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Speichern");
    }
    setEditAccount(null);
    await fetchAccounts();
    showFeedback("success", "E-Mail-Konto aktualisiert");
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/email-accounts/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showFeedback("error", data.error || "Fehler beim Loeschen");
      } else {
        await fetchAccounts();
        showFeedback("success", "E-Mail-Konto geloescht");
      }
    } catch {
      showFeedback("error", "Verbindungsfehler");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/email-accounts/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: { ok: data.ok, error: data.error } }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: "Verbindungsfehler" } }));
    } finally {
      setTestingId(null);
    }
  };

  const editFormData: EmailAccountForm = editAccount
    ? {
        name: editAccount.name,
        imapHost: editAccount.imapHost,
        imapPort: editAccount.imapPort,
        useSsl: editAccount.useSsl ? "true" : "false",
        username: editAccount.username,
        password: "",
        folder: editAccount.folder,
        providerId: editAccount.providerId ? String(editAccount.providerId) : "",
      }
    : EMPTY_EMAIL_FORM;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              E-Mail-Konten
            </h3>
            <Badge variant={accounts.length > 0 ? "default" : "secondary"}>
              {accounts.length > 0 ? `${accounts.length} Konto${accounts.length > 1 ? "en" : ""}` : "Nicht konfiguriert"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            IMAP-Postfaecher fuer automatischen Lead-Import aus E-Mails.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <p className={`text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
              {feedback.message}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade E-Mail-Konten...
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Noch kein E-Mail-Konto konfiguriert
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Konto hinzufuegen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{a.name}</span>
                        <Badge variant={a.active ? "default" : "secondary"} className="text-xs">
                          {a.active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{a.imapHost}:{a.imapPort}</span>
                        <span>{a.username}</span>
                        <span>{a.folder}</span>
                        {a.useSsl && <span>SSL</span>}
                      </div>
                      {a.lastPolledAt && (
                        <p className="text-xs text-muted-foreground">
                          Letzter Abruf: {new Date(a.lastPolledAt).toLocaleString("de-DE")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditAccount(a)}
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(a.id)}
                        title="Loeschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Test connection */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs"
                      onClick={() => handleTest(a.id)}
                      disabled={testingId === a.id}
                    >
                      {testingId === a.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {testingId === a.id ? "Teste..." : "Verbindung testen"}
                    </Button>
                    {testResults[a.id] && (
                      <span className={`text-xs flex items-center gap-1 ${testResults[a.id].ok ? "text-emerald-600" : "text-destructive"}`}>
                        {testResults[a.id].ok ? (
                          <><CircleCheck className="h-3.5 w-3.5" /> Verbindung OK</>
                        ) : (
                          <><CircleX className="h-3.5 w-3.5" /> {testResults[a.id].error || "Fehlgeschlagen"}</>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && accounts.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Konto hinzufuegen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <EmailAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={EMPTY_EMAIL_FORM}
        onSave={handleAdd}
      />

      {/* Edit dialog */}
      <EmailAccountDialog
        open={editAccount !== null}
        onOpenChange={(open) => { if (!open) setEditAccount(null); }}
        initialData={editFormData}
        onSave={handleEdit}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>E-Mail-Konto loeschen</DialogTitle>
            <DialogDescription>
              Soll das Konto &quot;{accounts.find((a) => a.id === deleteId)?.name}&quot; wirklich geloescht werden? Diese Aktion kann nicht rueckgaengig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Loesche..." : "Loeschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface InsuranceCompany {
  id: number;
  name: string;
  active: boolean;
  productCount: number;
}

interface CompanyMapping {
  companyProductId: number;
  companyProductName: string;
  leadProductId: number | null;
  leadProductName: string | null;
  leadProductKuerzel: string | null;
  confidence: number | null;
  manuallyVerified: boolean;
}

function InsuranceCompanySection() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [openCompany, setOpenCompany] = useState<InsuranceCompany | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/insurance-companies");
      if (res.ok) setCompanies(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/insurance-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        await fetchCompanies();
        showFeedback("success", "Gesellschaft hinzugefuegt");
      } else {
        showFeedback("error", "Fehler beim Anlegen");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      const res = await fetch(`/api/insurance-companies/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchCompanies();
        showFeedback("success", "Gesellschaft geloescht");
      } else {
        showFeedback("error", "Fehler beim Loeschen");
      }
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Gesellschaften & Produkte
            </h3>
            <Badge variant={companies.length > 0 ? "default" : "secondary"}>
              {companies.length > 0 ? `${companies.length} Gesellschaft${companies.length > 1 ? "en" : ""}` : "Keine"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Lade Produktlisten deiner Versicherungsgesellschaften hoch. Die KI ordnet dann automatisch die Lead-Anbieter-Sparten den passenden Gesellschafts-Produkten zu.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <p className={`text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
              {feedback.message}
            </p>
          )}

          {/* Neue Gesellschaft anlegen */}
          <div className="flex gap-2">
            <Input
              placeholder="Gesellschaft hinzufuegen (z.B. Allianz, AXA, Gothaer)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              disabled={adding}
            />
            <Button onClick={handleAdd} disabled={adding || !newName.trim()} className="gap-1">
              <Plus className="h-4 w-4" />
              Hinzufuegen
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Gesellschaften...
            </div>
          ) : companies.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Noch keine Gesellschaften. Fuege eine hinzu und lade dann die Produktliste hoch.
            </p>
          ) : (
            <div className="space-y-2">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.productCount} Produkt{c.productCount !== 1 ? "e" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setOpenCompany(c)}
                    >
                      <Tag className="h-3.5 w-3.5" />
                      Verwalten
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verwalten-Dialog */}
      {openCompany && (
        <InsuranceCompanyDialog
          company={openCompany}
          onClose={() => { setOpenCompany(null); fetchCompanies(); }}
          onFeedback={showFeedback}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gesellschaft loeschen</DialogTitle>
            <DialogDescription>
              Alle Produkte und Mappings dieser Gesellschaft werden geloescht. Fortfahren?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Abbrechen</DialogClose>
            <Button variant="destructive" onClick={handleDelete} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InsuranceCompanyDialog({
  company,
  onClose,
  onFeedback,
}: {
  company: InsuranceCompany;
  onClose: () => void;
  onFeedback: (type: "success" | "error", message: string) => void;
}) {
  const [mappings, setMappings] = useState<CompanyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [allLeadProducts, setAllLeadProducts] = useState<{ id: number; name: string; kuerzel: string | null }[]>([]);
  const [newProductName, setNewProductName] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const [mRes, lpRes] = await Promise.all([
        fetch(`/api/insurance-companies/${company.id}/mappings`),
        fetch("/api/lead-products"),
      ]);
      if (mRes.ok) setMappings(await mRes.json());
      if (lpRes.ok) setAllLeadProducts(await lpRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMappings(); }, [company.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/insurance-companies/${company.id}/products`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        onFeedback("success", `${data.inserted} Produkte importiert`);
        await fetchMappings();
      } else {
        onFeedback("error", data.error || "Fehler beim Upload");
      }
    } catch {
      onFeedback("error", "Verbindungsfehler");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleMatch = async () => {
    setMatching(true);
    try {
      const res = await fetch(`/api/insurance-companies/${company.id}/match`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onFeedback("success", `${data.matched} von ${data.total} Produkten gematcht`);
        await fetchMappings();
      } else {
        onFeedback("error", data.error || "KI-Matching fehlgeschlagen");
      }
    } catch {
      onFeedback("error", "Verbindungsfehler");
    } finally {
      setMatching(false);
    }
  };

  const handleMappingChange = async (companyProductId: number, leadProductId: number | null) => {
    try {
      await fetch(`/api/insurance-companies/${company.id}/mappings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProductId, leadProductId }),
      });
      await fetchMappings();
    } catch {
      onFeedback("error", "Fehler beim Speichern");
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    setAddingProduct(true);
    try {
      const res = await fetch(`/api/insurance-companies/${company.id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName.trim() }),
      });
      if (res.ok) {
        setNewProductName("");
        await fetchMappings();
        onFeedback("success", "Produkt hinzugefuegt");
      } else {
        onFeedback("error", "Fehler beim Hinzufuegen");
      }
    } finally {
      setAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      const res = await fetch(`/api/insurance-companies/${company.id}/products/${productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchMappings();
        onFeedback("success", "Produkt geloescht");
      }
    } catch {
      onFeedback("error", "Fehler beim Loeschen");
    }
  };

  const handleSaveEdit = async (productId: number) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await fetch(`/api/insurance-companies/${company.id}/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      setEditingId(null);
      await fetchMappings();
    } catch {
      onFeedback("error", "Fehler beim Speichern");
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{company.name}</DialogTitle>
          <DialogDescription>
            Produkte hochladen und per KI den Lead-Sparten zuordnen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 py-2 flex-wrap">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer">
              <Upload className="h-4 w-4" />
              {uploading ? "Lade..." : "CSV hochladen"}
            </span>
          </label>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleMatch}
            disabled={matching || mappings.length === 0}
          >
            {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {matching ? "KI matcht..." : "KI-Matching starten"}
          </Button>
        </div>

        {/* Neues Produkt manuell hinzufuegen */}
        <div className="flex gap-2 pb-2">
          <Input
            placeholder="Produkt manuell hinzufuegen..."
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddProduct(); }}
            className="h-8 text-sm"
            disabled={addingProduct}
          />
          <Button
            size="sm"
            onClick={handleAddProduct}
            disabled={addingProduct || !newProductName.trim()}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Hinzufuegen
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade...
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Noch keine Produkte. Lade eine CSV hoch (Format: Gesellschaft,Produkt)
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Gesellschafts-Produkt</th>
                  <th className="text-left p-2 font-medium">Lead-Sparte</th>
                  <th className="text-right p-2 font-medium w-16">Konf.</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.companyProductId} className="border-t hover:bg-muted/30 group">
                    <td className="p-2">
                      {editingId === m.companyProductId ? (
                        <div className="flex gap-1">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(m.companyProductId);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleSaveEdit(m.companyProductId)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="block truncate">{m.companyProductName}</span>
                      )}
                    </td>
                    <td className="p-2">
                      <select
                        className="w-full h-8 text-xs rounded border border-input bg-transparent px-2"
                        value={m.leadProductId ?? ""}
                        onChange={(e) => handleMappingChange(m.companyProductId, e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="">— kein Mapping —</option>
                        {allLeadProducts.map((lp) => (
                          <option key={lp.id} value={lp.id}>
                            {lp.kuerzel ? `[${lp.kuerzel}] ` : ""}{lp.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right text-xs">
                      {m.manuallyVerified ? (
                        <span className="text-emerald-600">manuell</span>
                      ) : m.confidence != null ? (
                        <span className={m.confidence >= 0.85 ? "text-emerald-600" : m.confidence >= 0.7 ? "text-amber-600" : "text-destructive"}>
                          {Math.round(m.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingId(m.companyProductId);
                            setEditingName(m.companyProductName);
                          }}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteProduct(m.companyProductId)}
                          title="Loeschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AssignmentRule {
  id: number;
  providerId: number;
  productId: number | null;
  userId: number;
  active: boolean;
  providerName: string;
  productName: string | null;
  userName: string;
}

function LeadAssignmentSection() {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<{ id: number; name: string; productIds?: number[] }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string; kuerzel?: string | null }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<AssignmentRule | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchAll = async () => {
    try {
      const [rulesRes, provRes, prodRes, usersRes] = await Promise.all([
        fetch("/api/lead-assignment-rules"),
        fetch("/api/lead-providers"),
        fetch("/api/lead-products"),
        fetch("/api/users"),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (provRes.ok) {
        const provData = await provRes.json();
        // Nur aktive Provider
        setProviders(
          (Array.isArray(provData) ? provData : [])
            .filter((p: { active: boolean }) => p.active)
            .map((p: { id: number; name: string; productIds?: number[] }) => ({
              id: p.id,
              name: p.name,
              productIds: p.productIds || [],
            }))
        );
      }
      if (prodRes.ok) setProducts(await prodRes.json());
      if (usersRes.ok) {
        const userData = await usersRes.json();
        setAllUsers(Array.isArray(userData) ? userData.map((u: { id: number; name: string }) => ({ id: u.id, name: u.name })) : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSave = async (form: { providerId: number; productId: number | null; userId: number }) => {
    const isEdit = editRule !== null;
    const url = isEdit ? `/api/lead-assignment-rules/${editRule.id}` : "/api/lead-assignment-rules";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Speichern");
    }
    setEditRule(null);
    setDialogOpen(false);
    await fetchAll();
    showFeedback("success", isEdit ? "Regel aktualisiert" : "Regel hinzugefuegt");
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lead-assignment-rules/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        showFeedback("error", "Fehler beim Loeschen");
      } else {
        await fetchAll();
        showFeedback("success", "Regel geloescht");
      }
    } catch {
      showFeedback("error", "Verbindungsfehler");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Lead-Zuweisung
            </h3>
            <Badge variant={rules.length > 0 ? "default" : "secondary"}>
              {rules.length > 0 ? `${rules.length} Regel${rules.length > 1 ? "n" : ""}` : "Nicht konfiguriert"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatische Bearbeiter-Zuweisung bei eingehenden Leads. Pauschalregeln (ohne Produkt) gelten als Fallback.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <p className={`text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
              {feedback.message}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Zuweisungsregeln...
            </div>
          ) : rules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Noch keine Zuweisungsregeln konfiguriert
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={async () => { await fetchAll(); setEditRule(null); setDialogOpen(true); }}
              >
                <Plus className="h-4 w-4" />
                Regel hinzufuegen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg border p-3 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rule.providerName}</span>
                      {rule.productName ? (
                        <Badge variant="outline" className="text-xs">{rule.productName}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Alle Leadarten</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm">{rule.userName}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={async () => { await fetchAll(); setEditRule(rule); setDialogOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && rules.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => { await fetchAll(); setEditRule(null); setDialogOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              Regel hinzufuegen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <AssignmentRuleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) {
            // Beim Oeffnen: Provider neu laden damit productIds aktuell sind
            fetchAll();
            setDialogOpen(true);
          } else {
            setDialogOpen(false);
            setEditRule(null);
          }
        }}
        initialData={editRule ? { providerId: editRule.providerId, productId: editRule.productId, userId: editRule.userId } : { providerId: 0, productId: null, userId: 0 }}
        providers={providers}
        products={products}
        users={allUsers}
        onSave={handleSave}
        isEdit={editRule !== null}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Zuweisungsregel loeschen</DialogTitle>
            <DialogDescription>
              Soll diese Regel wirklich geloescht werden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Loesche..." : "Loeschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignmentRuleDialog({
  open,
  onOpenChange,
  initialData,
  providers,
  products,
  users,
  onSave,
  isEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: { providerId: number; productId: number | null; userId: number };
  providers: { id: number; name: string; productIds?: number[] }[];
  products: { id: number; name: string; kuerzel?: string | null }[];
  users: { id: number; name: string }[];
  onSave: (data: { providerId: number; productId: number | null; userId: number }) => Promise<void>;
  isEdit: boolean;
}) {
  const [form, setForm] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initialData);
      setError("");
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.providerId) {
      setError("Anbieter ist erforderlich");
      return;
    }
    if (!form.userId) {
      setError("Bearbeiter ist erforderlich");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Regel bearbeiten" : "Zuweisungsregel hinzufuegen"}</DialogTitle>
          <DialogDescription>
            Lege fest, welcher Bearbeiter Leads von einem Anbieter bekommt. Ohne Produkt gilt die Regel pauschal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Lead-Anbieter *</Label>
            <select
              className={selectClass}
              value={form.providerId}
              onChange={(e) => {
                const newProviderId = parseInt(e.target.value) || 0;
                // Produkt zuruecksetzen falls es beim neuen Anbieter nicht existiert
                const newProvider = providers.find((p) => p.id === newProviderId);
                const newProductIds = newProvider?.productIds || [];
                setForm((prev) => ({
                  ...prev,
                  providerId: newProviderId,
                  productId: prev.productId && newProductIds.includes(prev.productId) ? prev.productId : null,
                }));
              }}
              required
            >
              <option value={0}>-- Anbieter waehlen --</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Leadart / Produkt (optional)</Label>
            {(() => {
              // Nur Produkte die der gewaehlte Anbieter aktuell kauft
              const selectedProvider = providers.find((p) => p.id === form.providerId);
              const activeProductIds = selectedProvider?.productIds || [];
              const filteredProducts = form.providerId
                ? products.filter((p) => activeProductIds.includes(p.id))
                : [];
              return (
                <>
                  <select
                    className={selectClass}
                    value={form.productId ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value ? parseInt(e.target.value) : null }))}
                    disabled={!form.providerId}
                  >
                    <option value="">Alle Leadarten (pauschal)</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kuerzel ? `[${p.kuerzel}] ` : ""}{p.name}
                      </option>
                    ))}
                  </select>
                  {!form.providerId && (
                    <p className="text-xs text-muted-foreground">Zuerst Anbieter waehlen</p>
                  )}
                  {form.providerId && filteredProducts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Dieser Anbieter hat keine aktiven Produkte. Wechsle zu &quot;Alle Leadarten (pauschal)&quot; oder aktiviere Produkte im Anbieter-Dialog.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
          <div className="space-y-2">
            <Label>Bearbeiter *</Label>
            <select
              className={selectClass}
              value={form.userId}
              onChange={(e) => setForm((p) => ({ ...p, userId: parseInt(e.target.value) || 0 }))}
              required
            >
              <option value={0}>-- Bearbeiter waehlen --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Abbrechen
            </DialogClose>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AIBackendSection({
  settings,
  onSave,
}: {
  settings: SettingsMap;
  onSave: (values: SettingsMap) => Promise<void>;
}) {
  const [backend, setBackend] = useState(settings["ai.backend"] || "anthropic");
  const [localaiUrl, setLocalaiUrl] = useState(settings["ai.localaiUrl"] || "http://localhost:8080");
  const [customUrl, setCustomUrl] = useState(settings["ai.customUrl"] || "");
  const [customApiKey, setCustomApiKey] = useState(settings["ai.customApiKey"] || "");
  const [model, setModel] = useState(settings["ai.model"] || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    setBackend(settings["ai.backend"] || "anthropic");
    setLocalaiUrl(settings["ai.localaiUrl"] || "http://localhost:8080");
    setCustomUrl(settings["ai.customUrl"] || "");
    setCustomApiKey(settings["ai.customApiKey"] || "");
    setModel(settings["ai.model"] || "");
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    await onSave({
      "ai.backend": backend,
      "ai.localaiUrl": localaiUrl,
      "ai.customUrl": customUrl,
      "ai.customApiKey": customApiKey,
      "ai.model": model,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", { method: "POST" });
      const data = await res.json();
      setTestResult({ ok: data.ok, error: data.error });
    } catch {
      setTestResult({ ok: false, error: "Verbindungsfehler" });
    } finally {
      setTesting(false);
    }
  };

  const active = backend !== "" && backend !== "anthropic"
    ? true
    : !!settings["ai.backend"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            KI-Backend
          </h3>
          <Badge variant={active ? "default" : "secondary"}>
            {backend === "anthropic" ? "Anthropic" : backend === "localai" ? "LocalAI" : backend === "custom" ? "Benutzerdefiniert" : "Nicht konfiguriert"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          KI-Anbieter für PDF-Import und Textanalyse. Standard: Anthropic (Claude).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Backend</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={backend}
            onChange={(e) => { setBackend(e.target.value); setTestResult(null); }}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="localai">LocalAI (Lokal)</option>
            <option value="custom">Benutzerdefiniert (OpenAI-kompatibel)</option>
          </select>
        </div>

        {backend === "anthropic" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              API Key wird aus der Umgebungsvariable <code className="font-mono text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">ANTHROPIC_API_KEY</code> gelesen.
            </p>
          </div>
        )}

        {backend === "localai" && (
          <div className="space-y-2">
            <Label>LocalAI URL</Label>
            <Input
              placeholder="http://localhost:8080"
              value={localaiUrl}
              onChange={(e) => setLocalaiUrl(e.target.value)}
            />
          </div>
        )}

        {backend === "custom" && (
          <>
            <div className="space-y-2">
              <Label>API URL</Label>
              <Input
                placeholder="https://api.example.com"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                onFocus={(e) => {
                  const val = e.target.value;
                  if (val.includes("...") && val.length <= 10) {
                    setCustomApiKey("");
                  }
                }}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Modell (optional)</Label>
          <Input
            placeholder="Standard-Modell verwenden"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leer lassen für das Standard-Modell des Backends.
          </p>
        </div>

        {testResult && (
          <div
            className={`rounded-lg border p-3 flex items-center gap-2 ${
              testResult.ok
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
                : "border-destructive/50 bg-destructive/10"
            }`}
          >
            {testResult.ok ? (
              <CircleCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <CircleX className="h-5 w-5 text-destructive" />
            )}
            <span className={`text-sm ${testResult.ok ? "text-emerald-800 dark:text-emerald-200" : "text-destructive"}`}>
              {testResult.ok ? "Verbindung erfolgreich!" : `Fehler: ${testResult.error || "Verbindung fehlgeschlagen"}`}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saving ? "Speichere..." : saved ? "Gespeichert" : "Speichern"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {testing ? "Teste..." : "Verbindung testen"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [settings, setSettings] = useState<SettingsMap>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [totpMessage, setTotpMessage] = useState("");
  const [totpError, setTotpError] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => setSettings(data))
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    async function check2faStatus() {
      try {
        const res = await fetch("/api/auth/2fa/status");
        if (res.ok) {
          const data = await res.json();
          setTotpEnabled(data.enabled);
        }
      } catch {}
    }
    check2faStatus();
  }, []);

  const saveSection = async (values: SettingsMap) => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      // Reload all settings to get fresh masked values
      const fresh = await fetch("/api/settings").then((r) => r.json());
      setSettings(fresh);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setMessage("Passwort erfolgreich geändert");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json();
      setError(data.error || "Fehler beim Ändern des Passworts");
    }
  };

  const handleSetup2FA = async () => {
    setTotpError("");
    setTotpMessage("");
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
      setSetupMode(true);
    } else {
      setTotpError("Fehler beim Einrichten von 2FA");
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError("");
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: verifyCode }),
    });

    if (res.ok) {
      setTotpEnabled(true);
      setSetupMode(false);
      setVerifyCode("");
      setTotpMessage("2FA erfolgreich aktiviert!");
    } else {
      const data = await res.json();
      setTotpError(data.error || "Ungültiger Code");
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError("");
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword }),
    });

    if (res.ok) {
      setTotpEnabled(false);
      setDisablePassword("");
      setTotpMessage("2FA deaktiviert");
    } else {
      const data = await res.json();
      setTotpError(data.error || "Fehler beim Deaktivieren");
    }
  };

  // Logo Upload
  const [logoPreview, setLogoPreview] = useState<string>(settings["company.logo"] || "/logo.png");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMessage, setLogoMessage] = useState("");

  useEffect(() => {
    if (settings["company.logo"]) {
      setLogoPreview(settings["company.logo"]);
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setLogoMessage("");

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setLogoPreview(data.logo + "?t=" + Date.now());
        setLogoMessage("Logo gespeichert");
        // Reload settings
        const fresh = await fetch("/api/settings").then((r) => r.json());
        setSettings(fresh);
        setTimeout(() => setLogoMessage(""), 2000);
      } else {
        setLogoMessage(data.error || "Upload fehlgeschlagen");
      }
    } catch {
      setLogoMessage("Verbindungsfehler");
    } finally {
      setLogoUploading(false);
    }
  };

  const COMPANY_FIELDS = [
    { key: "company.name", label: "Firmenname", placeholder: "z.B. Mustermann Versicherungen" },
    { key: "company.subtitle", label: "Untertitel", placeholder: "z.B. Allianz Generalvertretung" },
    { key: "company.color", label: "Primärfarbe (Hex)", placeholder: "#003781" },
  ];

  const OBSIDIAN_FIELDS: SettingsField[] = [
    { key: "obsidian.vaultPath", label: "Vault-Pfad", placeholder: "/Users/name/Obsidian/MeinVault" },
    { key: "obsidian.reportFolder", label: "Report-Ordner im Vault", placeholder: "Reports/Sales Hub" },
  ];

  const PUSHOVER_FIELDS = [
    { key: "pushover.userKey", label: "User Key", placeholder: "Pushover User Key" },
    { key: "pushover.apiToken", label: "API Token", placeholder: "Pushover API Token" },
  ];

  const TELEGRAM_FIELDS = [
    { key: "telegram.botToken", label: "Bot Token", placeholder: "123456:ABC-DEF..." },
    { key: "telegram.chatId", label: "Chat ID", placeholder: "123456789" },
  ];

  const EMAIL_FIELDS = [
    { key: "email.resendApiKey", label: "Resend API Key", placeholder: "re_..." },
    { key: "email.fromAddress", label: "Absenderadresse", placeholder: "noreply@example.com" },
  ];

  const SUPERCHAT_FIELDS = [
    { key: "superchat.apiKey", label: "API Key", placeholder: "Superchat API Key" },
  ];

  const [activeCategory, setActiveCategory] = useState<string>("general");

  const categories = [
    { id: "general", label: "Allgemein", icon: Building2, adminOnly: true },
    { id: "leads", label: "Lead-Management", icon: Inbox, adminOnly: true },
    { id: "companies", label: "Gesellschaften", icon: ShieldCheck, adminOnly: true },
    { id: "ai-mail", label: "KI & Mail", icon: Brain, adminOnly: true },
    { id: "notifications", label: "Benachrichtigungen", icon: Bell, adminOnly: true },
    { id: "integrations", label: "Integrationen", icon: Send, adminOnly: true },
    { id: "account", label: "Account & Sicherheit", icon: Shield, adminOnly: false },
  ];

  const visibleCategories = categories.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full">
      <Header title="Einstellungen" />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r bg-muted/20 p-3 overflow-y-auto shrink-0 hidden sm:block">
          <nav className="space-y-1">
            {visibleCategories.map((c) => {
              const Icon = c.icon;
              const isActive = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile: Category-Select */}
        <div className="sm:hidden px-4 pt-4 shrink-0">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
          >
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl space-y-6">

        {/* === ALLGEMEIN === */}
        {activeCategory === "general" && isAdmin && (
          <>
            <SettingsSection
              icon={<Building2 className="h-5 w-5" />}
              title="Firma"
              description="Name und Branding deiner Instanz. Wird in Sidebar, Login, E-Mails und Reports angezeigt."
              fields={COMPANY_FIELDS}
              settings={settings}
              onSave={saveSection}
            />

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Firmenlogo
                </h3>
                <p className="text-sm text-muted-foreground">
                  Logo wird in Sidebar, Login und Reports angezeigt. PNG, JPG, SVG oder WebP, max. 2 MB.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl border bg-muted/50 p-2">
                    <Image
                      src={logoPreview}
                      alt="Firmenlogo"
                      width={64}
                      height={64}
                      className="rounded-lg object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                        <Upload className="h-4 w-4" />
                        {logoUploading ? "Wird hochgeladen…" : "Logo hochladen"}
                      </span>
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                    {logoMessage && (
                      <p className={`text-sm ${logoMessage.includes("gespeichert") ? "text-emerald-600" : "text-destructive"}`}>
                        {logoMessage}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <SettingsSection
              icon={<BookOpen className="h-5 w-5" />}
              title="Obsidian"
              description="Vault-Pfad für automatischen Report-Export. Ohne Pfad werden Reports als Download angeboten."
              fields={OBSIDIAN_FIELDS}
              settings={settings}
              onSave={saveSection}
            />
          </>
        )}

        {/* === LEAD-MANAGEMENT === */}
        {activeCategory === "leads" && isAdmin && (
          <>
            <LeadProviderSection />
            <LeadProductSection />
            <LeadAssignmentSection />
          </>
        )}

        {/* === GESELLSCHAFTEN === */}
        {activeCategory === "companies" && isAdmin && (
          <InsuranceCompanySection />
        )}

        {/* === KI & MAIL === */}
        {activeCategory === "ai-mail" && isAdmin && (
          <>
            <AIBackendSection settings={settings} onSave={saveSection} />
            <EmailAccountSection />
            <SettingsSection
              icon={<Mail className="h-5 w-5" />}
              title="E-Mail (Resend)"
              description="E-Mail-Versand für Passwort-Reset und Willkommensnachrichten."
              fields={EMAIL_FIELDS}
              settings={settings}
              onSave={saveSection}
            />
          </>
        )}

        {/* === BENACHRICHTIGUNGEN === */}
        {activeCategory === "notifications" && isAdmin && (
          <>
            <SettingsSection
              icon={<Bell className="h-5 w-5" />}
              title="Pushover"
              description="Push-Benachrichtigungen für Folgetermine und neue Leads."
              fields={PUSHOVER_FIELDS}
              settings={settings}
              onSave={saveSection}
            />
            <SettingsSection
              icon={<Send className="h-5 w-5" />}
              title="Telegram"
              description="Telegram-Bot für Benachrichtigungen und Self-Healing Alerts."
              fields={TELEGRAM_FIELDS}
              settings={settings}
              onSave={saveSection}
            />
          </>
        )}

        {/* === INTEGRATIONEN === */}
        {activeCategory === "integrations" && isAdmin && (
          <SettingsSection
            icon={<MessageSquare className="h-5 w-5" />}
            title="Superchat"
            description="Superchat-Integration für Kontakt-Synchronisation."
            fields={SUPERCHAT_FIELDS}
            settings={settings}
            onSave={saveSection}
          />
        )}

        {/* === ACCOUNT & SICHERHEIT === */}
        {activeCategory === "account" && (
          <>
        {/* Account Info */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-sm font-medium">{session?.user?.name || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-Mail</p>
              <p className="text-sm font-medium">{session?.user?.email || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rolle</p>
              <p className="text-sm font-medium capitalize">
                {(session?.user as { role?: string })?.role || "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" />
              Passwort ändern
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label>Aktuelles Passwort</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Neues Passwort</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Passwort bestätigen</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-emerald-600">{message}</p>}
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Passwort ändern
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 2FA */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Zwei-Faktor-Authentifizierung (2FA)
            </h3>
            <p className="text-sm text-muted-foreground">
              Schütze deinen Account mit einem zusätzlichen Code aus einer Authenticator-App.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {totpMessage && <p className="text-sm text-emerald-600">{totpMessage}</p>}
            {totpError && <p className="text-sm text-destructive">{totpError}</p>}

            {!totpEnabled && !setupMode && (
              <Button onClick={handleSetup2FA} className="bg-primary hover:bg-primary/90">
                2FA einrichten
              </Button>
            )}

            {setupMode && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">1. Scanne diesen QR-Code mit deiner Authenticator-App:</p>
                  {qrCode && (
                    <div className="flex justify-center">
                      <Image src={qrCode} alt="2FA QR Code" width={200} height={200} />
                    </div>
                  )}
                  <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Manueller Code</summary>
                    <code className="mt-2 block rounded bg-muted p-2 text-xs break-all">{totpSecret}</code>
                  </details>
                </div>
                <form onSubmit={handleVerify2FA} className="space-y-3">
                  <p className="text-sm font-medium">2. Gib den 6-stelligen Code ein:</p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-xl tracking-widest max-w-[200px]"
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="bg-primary hover:bg-primary/90">
                      Aktivieren
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setSetupMode(false)}>
                      Abbrechen
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {totpEnabled && !setupMode && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">2FA ist aktiv</span>
                </div>
                <form onSubmit={handleDisable2FA} className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Um 2FA zu deaktivieren, gib dein Passwort ein:
                  </p>
                  <Input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Passwort"
                    required
                    className="max-w-[300px]"
                  />
                  <Button type="submit" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                    2FA deaktivieren
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}

          </div>
        </div>
      </div>
    </div>
  );
}
