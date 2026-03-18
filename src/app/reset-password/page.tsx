"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Ungültiger Link</p>
        <p className="mt-2 text-sm text-red-700">Der Reset-Link ist ungültig oder unvollständig.</p>
        <a href="/forgot-password" className="mt-4 inline-block text-sm text-[#003781] hover:underline">
          Neuen Link anfordern
        </a>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler aufgetreten");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-medium text-emerald-800">Passwort geändert!</p>
        <p className="mt-2 text-sm text-emerald-700">Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
        <a href="/login" className="mt-4 inline-block rounded-md bg-[#003781] px-4 py-2 text-sm text-white hover:bg-[#002a63]">
          Zum Login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Neues Passwort</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mindestens 6 Zeichen"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Passwort bestätigen</Label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full bg-[#003781] hover:bg-[#002a63]" disabled={loading}>
        {loading ? "Wird gespeichert..." : "Passwort setzen"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#003781]/5 to-[#c4a035]/5">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <Image src="/logo.png" alt="VÖLKER Finance OHG" width={80} height={80} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#003781]">Neues Passwort setzen</h1>
        </div>
        <Suspense fallback={<div className="text-center text-muted-foreground">Laden...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
