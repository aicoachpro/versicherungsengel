"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ReportButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => window.open("/api/reports/pdf", "_blank")}
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">PDF-Report</span>
    </Button>
  );
}
