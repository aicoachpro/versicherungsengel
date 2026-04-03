"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, FileText, CalendarDays, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ReportButton() {
  const searchParams = useSearchParams();
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const handlePdfDownload = async () => {
    setLoadingPdf(true);
    const month = searchParams.get("month") || new Date().getMonth() + 1;
    const year = searchParams.get("year") || new Date().getFullYear();
    const url = `/api/reports/pdf?month=${month}&year=${year}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("PDF-Generierung fehlgeschlagen");

      const blob = await res.blob();
      const filename = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1]
        || `report-${year}-${String(month).toString().padStart(2, "0")}.pdf`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${filename} heruntergeladen`);
    } catch {
      toast.error("PDF-Export fehlgeschlagen");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExport = async (type: "monthly" | "weekly") => {
    const setLoading = type === "weekly" ? setLoadingWeek : setLoadingMonth;
    setLoading(true);

    const url = type === "weekly"
      ? "/api/reports/obsidian/weekly"
      : `/api/reports/obsidian?month=${searchParams.get("month") || new Date().getMonth() + 1}&year=${searchParams.get("year") || new Date().getFullYear()}`;

    try {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.ok) {
          toast.success(`Report ins Vault geschrieben: ${data.filename}`);
        } else {
          toast.error("Fehler beim Schreiben ins Vault");
        }
      } else {
        const blob = await res.blob();
        const filename = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1]
          || `report-${type}.md`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`${filename} heruntergeladen`);
      }
    } catch {
      toast.error("Export fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={loadingPdf}
        onClick={handlePdfDownload}
      >
        {loadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span className="hidden sm:inline">PDF</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={loadingWeek}
        onClick={() => handleExport("weekly")}
      >
        {loadingWeek ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
        <span className="hidden sm:inline">Woche</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={loadingMonth}
        onClick={() => handleExport("monthly")}
      >
        {loadingMonth ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        <span className="hidden sm:inline">Monat</span>
      </Button>
    </div>
  );
}
