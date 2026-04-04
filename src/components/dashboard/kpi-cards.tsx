"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Target,
  DollarSign,
  Trophy,
  RefreshCw,
  Package,
  ChevronLeft,
  ChevronRight,
  Rocket,
  BarChart3,
} from "lucide-react";

interface LeadBudgetMonth {
  month: string;
  total: number;
  reklamiert: number;
  netto: number;
  expected: number;
  carryOver: number;
  outstanding: number;
}

interface LeadBudgetData {
  budget: number;
  costPerLead: number;
  months: LeadBudgetMonth[];
}

interface KpiCardsProps {
  wonLeads: number;
  openLeads: number;
  revenue: number;
  costs: number;
  roi: number;
  leadBudget: LeadBudgetData;
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mär", "04": "Apr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez",
};

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(raw: string): string {
  const [y, m] = raw.split("-");
  return `${MONTH_NAMES[m] || m} ${y}`;
}

function CycleCard({ revenue, costs, roi }: { revenue: number; costs: number; roi: number }) {
  const [index, setIndex] = useState(0);

  const slides = [
    {
      title: "ROI",
      value: `${roi}%`,
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      title: "Umsatz",
      value: currencyFormat.format(revenue),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Kosten",
      value: currencyFormat.format(costs),
      icon: DollarSign,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
    },
  ];

  const current = slides[index];

  return (
    <Card
      className="shadow-sm cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
      onClick={() => setIndex((i) => (i + 1) % slides.length)}
    >
      <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${current.bg}`}>
          <current.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${current.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground sm:text-sm font-medium">{current.title}</p>
          <p className="text-lg font-bold tracking-tight sm:text-2xl">{current.value}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40" />
          <div className="flex gap-0.5">
            {slides.map((_, i) => (
              <div key={i} className={`h-1 w-1 rounded-full ${i === index ? "bg-foreground/60" : "bg-foreground/15"}`} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadBudgetCard({ data }: { data: LeadBudgetData }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(now));

  const navigate = (direction: -1 | 1) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setSelectedMonth(getMonthKey(d));
  };

  const monthData = data.months.find((m) => m.month === selectedMonth);
  const netto = monthData?.netto ?? 0;
  const reklamiert = monthData?.reklamiert ?? 0;
  const expected = monthData?.expected ?? data.budget;
  const carryOver = monthData?.carryOver ?? 0;
  const outstanding = monthData?.outstanding ?? 0;

  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 bg-cyan-50 dark:bg-cyan-950/30">
          <Package className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="rounded p-0.5 hover:bg-accent transition-colors"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </button>
            <p className="text-[10px] text-muted-foreground sm:text-xs font-medium">
              {formatMonth(selectedMonth)}
            </p>
            <button
              onClick={() => navigate(1)}
              className="rounded p-0.5 hover:bg-accent transition-colors"
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          {(() => {
            const ratio = expected > 0 ? netto / expected : 0;
            const pct = Math.min(ratio * 100, 100);
            const barColor =
              ratio >= 1
                ? "bg-emerald-500"
                : ratio > 0.7
                  ? "bg-amber-500"
                  : "bg-red-500";
            return (
              <>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                  {netto} von {expected} erwartet
                  {reklamiert > 0 && ` \u00b7 ${reklamiert} reklamiert`}
                </p>
                {carryOver > 0 && (
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    inkl. {carryOver} Guthaben aus Vormonaten
                  </p>
                )}
                {outstanding > 0 && (
                  <p className="text-[10px] text-amber-600 sm:text-xs font-medium">
                    {outstanding} Leads ausstehend
                  </p>
                )}
              </>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ wonLeads, openLeads, revenue, costs, roi, leadBudget }: KpiCardsProps) {
  const allZero = wonLeads === 0 && openLeads === 0 && revenue === 0 && costs === 0;

  if (allZero) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Willkommen im Dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">
              Importiere deinen ersten Lead um loszulegen.
            </p>
          </div>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Zur Pipeline
          </Link>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    {
      title: "Offene Leads",
      value: openLeads.toString(),
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      href: "/pipeline?filter=offen&scrollToPhase=Termin%20eingegangen",
    },
    {
      title: "Abschlüsse",
      value: wonLeads.toString(),
      icon: Trophy,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      href: "/pipeline?filter=abgeschlossen&scrollToPhase=Abgeschlossen",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.title} href={card.href}>
          <Card className="shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
            <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-6">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${card.bg}`}>
                <card.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground sm:text-sm font-medium">{card.title}</p>
                <p className="text-lg font-bold tracking-tight sm:text-2xl">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
      <CycleCard revenue={revenue} costs={costs} roi={roi} />
      {leadBudget.budget > 0 && <LeadBudgetCard data={leadBudget} />}
    </div>
  );
}
