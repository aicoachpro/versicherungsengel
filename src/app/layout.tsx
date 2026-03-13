import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "VÖLKER Finance | Sales Hub",
  description: "Sales Hub für VÖLKER Finance OHG – Allianz Generalvertretung",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
