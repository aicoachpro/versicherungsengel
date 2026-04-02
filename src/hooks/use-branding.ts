"use client";

import { useState, useEffect } from "react";

interface Branding {
  companyName: string;
  subtitle: string;
  color: string;
}

const DEFAULT: Branding = { companyName: "Sales Hub", subtitle: "", color: "#003781" };

let cached: Branding | null = null;

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cached || DEFAULT);

  useEffect(() => {
    if (cached) return;
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        cached = data;
        setBranding(data);
      })
      .catch(() => {});
  }, []);

  return branding;
}
