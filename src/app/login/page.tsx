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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Ungültige Anmeldedaten");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#003781] via-[#002a63] to-[#001d45]">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="space-y-4 pb-2 text-center">
          {/* Logo */}
          <Image
            src="/logo.png"
            alt="VÖLKER Finance OHG"
            width={80}
            height={80}
            className="mx-auto"
            priority
          />
          <div>
            <h1 className="text-xl font-bold text-foreground">
              VÖLKER Finance OHG
            </h1>
            <p className="text-sm text-muted-foreground">
              Sales Hub – Allianz Generalvertretung
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-[#003781] hover:bg-[#002a63]"
              disabled={loading}
            >
              {loading ? "Wird angemeldet..." : "Anmelden"}
            </Button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Wir übernehmen Verantwortung
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
