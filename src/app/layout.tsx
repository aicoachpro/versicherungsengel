import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getBranding } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  const b = getBranding();
  return {
    title: `${b.companyName}${b.subtitle ? " | " + b.subtitle : ""}`,
    description: b.subtitle ? `${b.subtitle} – ${b.companyName}` : b.companyName,
    icons: {
      icon: "/logo.png",
      apple: "/logo.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="antialiased">
        {process.env.DEMO_MODE === "true" && (
          <div className="bg-amber-500 text-white text-center text-xs py-1 font-medium fixed top-0 left-0 right-0 z-[9999]">
            Demo-Modus — keine echten Daten
          </div>
        )}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SessionProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="bottom-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
