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
};

const EMPTY_FORM: LeadProviderForm = {
  name: "",
  leadType: "",
  minPerMonth: 10,
  costPerLead: 320,
  billingModel: "prepaid",
  carryOver: "true",
  startMonth: "",
};

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: LeadProviderForm;
  onSave: (data: LeadProviderForm) => Promise<void>;
}) {
  const [form, setForm] = useState<LeadProviderForm>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = initialData.name !== "";

  useEffect(() => {
    if (open) {
      setForm(initialData);
      setError("");
    }
  }, [open, initialData]);

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
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fehler beim Anlegen");
    }
    await fetchProviders();
    showFeedback("success", "Anbieter hinzugefügt");
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

  return (
    <div className="flex flex-col">
      <Header title="Einstellungen" />
      <div className="flex-1 p-6 space-y-6 max-w-2xl">
        {/* Admin-only sections */}
        {isAdmin && (
          <>
            <SettingsSection
              icon={<Building2 className="h-5 w-5" />}
              title="Firma"
              description="Name und Branding deiner Instanz. Wird in Sidebar, Login, E-Mails und Reports angezeigt."
              fields={COMPANY_FIELDS}
              settings={settings}
              onSave={saveSection}
            />

            {/* Logo Upload */}
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

            <LeadProviderSection />

            <SettingsSection
              icon={<BookOpen className="h-5 w-5" />}
              title="Obsidian"
              description="Vault-Pfad für automatischen Report-Export. Ohne Pfad werden Reports als Download angeboten."
              fields={OBSIDIAN_FIELDS}
              settings={settings}
              onSave={saveSection}
            />

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

            <SettingsSection
              icon={<Mail className="h-5 w-5" />}
              title="E-Mail (Resend)"
              description="E-Mail-Versand für Passwort-Reset und Willkommensnachrichten."
              fields={EMAIL_FIELDS}
              settings={settings}
              onSave={saveSection}
            />

            <SettingsSection
              icon={<MessageSquare className="h-5 w-5" />}
              title="Superchat"
              description="Superchat-Integration für Kontakt-Synchronisation."
              fields={SUPERCHAT_FIELDS}
              settings={settings}
              onSave={saveSection}
            />
          </>
        )}

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
      </div>
    </div>
  );
}
