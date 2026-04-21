"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const PREFIX = "voe.filter.";

export function readSessionFilter(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeSessionFilter(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === "") {
      window.sessionStorage.removeItem(PREFIX + key);
    } else {
      window.sessionStorage.setItem(PREFIX + key, value);
    }
  } catch {
    // sessionStorage not available — ignore
  }
}

/**
 * Synct einen URL-Query-Param mit sessionStorage.
 *
 * Beim Mount: wenn der URL-Param NICHT gesetzt ist, aber sessionStorage einen
 * Wert hat, wird via router.replace der URL-Param auf den sessionStorage-Wert
 * gesetzt (kein Reload, nur History-Replace).
 *
 * Beim Ändern von `urlValue`: der neue Wert wird in sessionStorage geschrieben
 * (oder entfernt wenn null/leer).
 */
export function useSessionFilterSync(key: string, urlValue: string | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Rehydrate: wenn URL leer, aber sessionStorage hat Wert → URL setzen
  useEffect(() => {
    if (urlValue !== null && urlValue !== "") return;
    const stored = readSessionFilter(key);
    if (!stored) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set(key, stored);
    router.replace(`${pathname}?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist: wenn URL-Param sich ändert, sessionStorage angleichen
  useEffect(() => {
    writeSessionFilter(key, urlValue);
  }, [key, urlValue]);
}
