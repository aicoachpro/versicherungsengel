"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";
import { Shield, Key, Smartphone } from "lucide-react";
import Image from "next/image";

export default function SettingsPage() {
  const { data: session } = useSession();
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
    fetch("/api/auth/2fa/setup", { method: "GET" }).catch(() => {});
    // Check 2FA status
    fetch("/api/auth/change-password", {
      method: "GET",
    }).catch(() => {});
  }, []);

  // Fetch 2FA status on load
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

  return (
    <div className="flex flex-col">
      <Header title="Einstellungen" />
      <div className="flex-1 p-6 space-y-6 max-w-2xl">
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
