"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

export function ReportButton() {
  const searchParams = useSearchParams();

  const obsidianExport = () => {
    const month = searchParams.get("month") || String(new Date().getMonth() + 1);
    const year = searchParams.get("year") || String(new Date().getFullYear());
    window.open(`/api/reports/obsidian?month=${month}&year=${year}`, "_blank");
  };

  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => window.open("/api/reports/pdf", "_blank")}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">PDF</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={obsidianExport}
      >
        <FileText className="h-4 w-4" />
        <span className="hidden sm:inline">Obsidian</span>
      </Button>
    </div>
  );
}
