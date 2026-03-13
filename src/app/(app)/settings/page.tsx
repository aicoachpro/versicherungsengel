"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "next-auth/react";
import { Shield, Key } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
              <Button type="submit" className="bg-[#003781] hover:bg-[#002a63]">
                Passwort ändern
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
