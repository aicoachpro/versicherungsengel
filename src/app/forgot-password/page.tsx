"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler aufgetreten");
      } else {
        setSent(true);
      }
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#003781]/5 to-[#c4a035]/5">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <Image src="/logo.png" alt="VÖLKER Finance OHG" width={80} height={80} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#003781]">Passwort vergessen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="font-medium text-emerald-800">E-Mail gesendet!</p>
            <p className="mt-2 text-sm text-emerald-700">
              Falls ein Account mit dieser E-Mail existiert, erhältst du in Kürze einen Link zum Zurücksetzen.
            </p>
            <a href="/login" className="mt-4 inline-block text-sm text-[#003781] hover:underline">
              Zurück zum Login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="thomas@voelker.finance"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-[#003781] hover:bg-[#002a63]"
              disabled={loading}
            >
              {loading ? "Wird gesendet..." : "Link senden"}
            </Button>
            <a href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
              Zurück zum Login
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
