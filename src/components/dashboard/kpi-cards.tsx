import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, BarChart3 } from "lucide-react";

interface KpiCardsProps {
  openLeads: number;
  conversionRate: number;
  revenue: number;
  roi: number;
}

export function KpiCards({ openLeads, conversionRate, revenue, roi }: KpiCardsProps) {
  const cards = [
    {
      title: "Offene Leads",
      value: openLeads.toString(),
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
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
    },
    {
      title: "ROI",
      value: `${roi}%`,
      icon: BarChart3,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
