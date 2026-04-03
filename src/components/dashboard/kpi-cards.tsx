"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Target,
  DollarSign,
  BarChart3,
  Trophy,
  RefreshCw,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface LeadBudgetMonth {
  month: string;
  total: number;
  reklamiert: number;
  netto: number;
}

interface LeadBudgetData {
  budget: number;
  months: LeadBudgetMonth[];
}

interface KpiCardsProps {
  wonLeads: number;
  openLeads: number;
  conversionRate: number;
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

function FlipCard({ revenue, costs }: { revenue: number; costs: number }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="[perspective:600px] cursor-pointer"
      onClick={() => setFlipped((f) => !f)}
    >
      <div
        className="relative transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <Card className="shadow-sm [backface-visibility:hidden]">
          <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 bg-amber-50 dark:bg-amber-950/30">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground sm:text-sm font-medium">Umsatz</p>
              <p className="text-lg font-bold tracking-tight sm:text-2xl">{currencyFormat.format(revenue)}</p>
            </div>
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          </CardContent>
        </Card>
        <Card className="absolute inset-0 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <CardContent className="flex items-center gap-3 p-3 sm:gap-4 sm:p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 bg-red-50 dark:bg-red-950/30">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground sm:text-sm font-medium">Kosten</p>
              <p className="text-lg font-bold tracking-tight sm:text-2xl">{currencyFormat.format(costs)}</p>
            </div>
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          </CardContent>
        </Card>
      </div>
    </div>
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
  const total = monthData?.total ?? 0;

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
          <p className="text-lg font-bold tracking-tight sm:text-2xl">
            {netto}
            <span className="text-sm font-normal text-muted-foreground"> / {data.budget}</span>
          </p>
          {reklamiert > 0 && (
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              {total} eingeg. · {reklamiert} rekl.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ wonLeads, openLeads, conversionRate, revenue, costs, roi, leadBudget }: KpiCardsProps) {
  const cards = [
    {
      title: "Abschlüsse",
      value: wonLeads.toString(),
      icon: Trophy,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      href: "/pipeline?filter=abgeschlossen&scrollToPhase=Abgeschlossen",
    },
    {
      title: "Offene Leads",
      value: openLeads.toString(),
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      href: "/pipeline?filter=offen&scrollToPhase=Termin%20eingegangen",
    },
    {
      title: "Conversion",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      href: "/pipeline?filter=abgeschlossen&scrollToPhase=Abgeschlossen",
    },
    {
      title: "ROI",
      value: `${roi}%`,
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      href: "/pipeline?scrollToPhase=Abgeschlossen",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
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
      <FlipCard revenue={revenue} costs={costs} />
      <LeadBudgetCard data={leadBudget} />
    </div>
  );
}
