import { getSetting } from "@/lib/settings";

export interface Branding {
  companyName: string;
  subtitle: string;
  color: string;
}

export function getBranding(): Branding {
  return {
    companyName: getSetting("company.name") || "Sales Hub",
    subtitle: getSetting("company.subtitle") || "",
    color: getSetting("company.color") || "#003781",
  };
}
