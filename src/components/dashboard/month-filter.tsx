"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function MonthFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const hasFilter = searchParams.has("month") && searchParams.has("year");
  const isAll = !hasFilter || searchParams.get("all") === "1";
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  function navigate(m: number, y: number, all?: boolean) {
    const params = new URLSearchParams();
    if (all) {
      params.set("all", "1");
    } else {
      params.set("month", String(m));
      params.set("year", String(y));
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  function prev() {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    navigate(m, y);
  }

  function next() {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    navigate(m, y);
  }

  function goToCurrentMonth() {
    navigate(now.getMonth() + 1, now.getFullYear());
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={isAll ? "default" : "outline"}
        size="xs"
        onClick={() => navigate(month, year, true)}
      >
        Gesamt
      </Button>
      <div className="flex items-center gap-0 rounded-lg border border-black/[0.08] bg-background shadow-sm shadow-black/[0.03]">
        <Button variant="ghost" size="icon-xs" onClick={prev}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <button
          onClick={goToCurrentMonth}
          className="min-w-[90px] sm:min-w-[120px] px-1 text-center text-xs sm:text-sm font-medium whitespace-nowrap"
        >
          {isAll ? "Alle" : `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`}
        </button>
        <Button variant="ghost" size="icon-xs" onClick={next} disabled={isCurrentMonth && !isAll}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
