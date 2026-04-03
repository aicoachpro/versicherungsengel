"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, BarChart3, UserPlus, RefreshCw } from "lucide-react";

interface KpiCardsProps {
  newLeads: number;
  openLeads: number;
  conversionRate: number;
  revenue: number;
  costs: number;
  roi: number;
}

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

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
        {/* Vorderseite: Umsatz */}
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

        {/* Rückseite: Kosten */}
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

export function KpiCards({ newLeads, openLeads, conversionRate, revenue, costs, roi }: KpiCardsProps) {
  const cards = [
    {
      title: "Neue Leads",
      value: newLeads.toString(),
      icon: UserPlus,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      href: "/pipeline",
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
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
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
    </div>
  );
}
