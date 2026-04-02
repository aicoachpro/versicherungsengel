"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";

export default function LoginPage() {
  const branding = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // If we don't know yet if 2FA is needed, check first
    if (!needs2fa) {
      try {
        const checkRes = await fetch("/api/auth/check-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const checkData = await checkRes.json();

        if (checkData.requires2fa) {
          setNeeds2fa(true);
          setLoading(false);
          return;
        }
      } catch {
        // If check fails, try login directly
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      totpCode: needs2fa ? totpCode : "",
      redirect: false,
    });

    if (result?.error) {
      if (result.error.includes("2FA_REQUIRED")) {
        setNeeds2fa(true);
      } else if (result.error.includes("INVALID_TOTP")) {
        setError("Ungültiger 2FA-Code");
      } else {
        setError("Ungültige Anmeldedaten");
      }
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-muted">
      <Card className="w-full max-w-md shadow-xl shadow-black/[0.06]">
        <CardHeader className="space-y-4 pb-2 text-center">
          <Image
            src="/logo.png"
            alt={branding.companyName}
            width={80}
            height={80}
            className="mx-auto"
            priority
          />
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {branding.companyName}
            </h1>
            {branding.subtitle && (
              <p className="text-sm text-muted-foreground">
                {branding.subtitle}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!needs2fa ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@voelker-finance.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totpCode">2FA-Code</Label>
                <p className="text-sm text-muted-foreground">
                  Gib den 6-stelligen Code aus deiner Authenticator-App ein.
                </p>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? "Wird angemeldet..." : needs2fa ? "Bestätigen" : "Anmelden"}
            </Button>
            {needs2fa && (
              <button
                type="button"
                onClick={() => { setNeeds2fa(false); setTotpCode(""); setError(""); }}
                className="w-full text-sm text-muted-foreground hover:underline"
              >
                Zurück
              </button>
            )}
          </form>
          {!needs2fa && (
            <div className="mt-4 text-center">
              <a href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary hover:underline">
                Passwort vergessen?
              </a>
            </div>
          )}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Wir übernehmen Verantwortung
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
