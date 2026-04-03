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

function LeadProviderSection({
  fields,
  settings,
  onSave,
}: {
  fields: SettingsField[];
  settings: SettingsMap;
  onSave: (values: SettingsMap) => Promise<void>;
}) {
  const minPerMonth = parseInt(settings["leadProvider.minPerMonth"] || "10", 10) || 0;
  const costPerLead = parseInt(settings["leadProvider.costPerLead"] || "320", 10) || 0;
  const monthlyCost = minPerMonth * costPerLead;

  const costFormat = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  return (
    <SettingsSection
      icon={<Package className="h-5 w-5" />}
      title="Lead-Anbieter"
      description="Konfiguration deines Lead-Anbieters. Nicht gelieferte Leads können als Guthaben übertragen werden."
      fields={fields}
      settings={settings}
      onSave={onSave}
      footer={
        monthlyCost > 0 ? (
          <p className="text-sm text-muted-foreground">
            Monatliche Fixkosten: <span className="font-medium">{costFormat.format(monthlyCost)}</span>
          </p>
        ) : null
      }
    />
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

  const LEAD_PROVIDER_FIELDS: SettingsField[] = [
    { key: "leadProvider.name", label: "Anbieter-Name", placeholder: "z.B. WVD Versicherungsdienst" },
    { key: "leadProvider.leadType", label: "Lead-Typ", placeholder: "z.B. Gewerbe-Leads" },
    { key: "leadProvider.minPerMonth", label: "Mindestabnahme pro Monat", placeholder: "10", type: "number" },
    { key: "leadProvider.costPerLead", label: "Kosten pro Lead in \u20ac", placeholder: "320", type: "number" },
    {
      key: "leadProvider.billingModel",
      label: "Abrechnungsmodell",
      placeholder: "",
      options: [
        { value: "prepaid", label: "Vorauszahlung" },
        { value: "per-lead", label: "Pay-per-Lead" },
      ],
    },
    {
      key: "leadProvider.carryOver",
      label: "Guthaben-\u00dcbertrag",
      placeholder: "",
      options: [
        { value: "true", label: "Ja \u2014 nicht gelieferte Leads werden \u00fcbertragen" },
        { value: "false", label: "Nein" },
      ],
    },
    { key: "leadProvider.startMonth", label: "Vertragsstart", placeholder: "", type: "month" },
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

            <LeadProviderSection
              fields={LEAD_PROVIDER_FIELDS}
              settings={settings}
              onSave={saveSection}
            />

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
