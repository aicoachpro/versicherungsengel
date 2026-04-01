import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, BarChart3, UserPlus } from "lucide-react";

interface KpiCardsProps {
  newLeads: number;
  openLeads: number;
  conversionRate: number;
  revenue: number;
  roi: number;
}

export function KpiCards({ newLeads, openLeads, conversionRate, revenue, roi }: KpiCardsProps) {
  const cards = [
    {
      title: "Neue Leads",
      value: newLeads.toString(),
      icon: UserPlus,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      href: "/pipeline",
    },
    {
      title: "Offene Leads",
      value: openLeads.toString(),
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/pipeline?filter=offen&scrollToPhase=Termin%20eingegangen",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: "/pipeline?filter=abgeschlossen&scrollToPhase=Abgeschlossen",
    },
    {
      title: "Umsatz",
      value: new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(revenue),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/pipeline?filter=abgeschlossen&scrollToPhase=Abgeschlossen",
    },
    {
      title: "ROI",
      value: `${roi}%`,
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/pipeline?scrollToPhase=Abgeschlossen",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
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
    </div>
  );
}
