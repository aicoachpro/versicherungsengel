import { getSetting } from "@/lib/settings";

export interface Branding {
  companyName: string;
  subtitle: string;
  color: string;
  logo: string;
}

export function getBranding(): Branding {
  return {
    companyName: getSetting("company.name") || "Sales Hub",
    subtitle: getSetting("company.subtitle") || "",
    color: getSetting("company.color") || "#003781",
    logo: getSetting("company.logo") || "/logo.png",
  };
}
