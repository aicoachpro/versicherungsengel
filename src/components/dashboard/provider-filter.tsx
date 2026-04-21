"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionFilterSync, writeSessionFilter } from "@/hooks/use-session-filter";

interface Provider {
  id: number;
  name: string;
  active: boolean;
}

export function ProviderFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("providerId");

  const [providers, setProviders] = useState<Provider[]>([]);

  useSessionFilterSync("providerId", current);

  useEffect(() => {
    fetch("/api/lead-providers")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Provider[]) => setProviders(data.filter((p) => p.active)))
      .catch(() => setProviders([]));
  }, []);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("providerId");
      writeSessionFilter("providerId", null);
    } else {
      params.set("providerId", value);
      writeSessionFilter("providerId", value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : window.location.pathname);
  }

  if (providers.length === 0) return null;

  return (
    <select
      value={current ?? "all"}
      onChange={onChange}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      aria-label="Leadlieferant-Filter"
    >
      <option value="all">Alle Anbieter</option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
