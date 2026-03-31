"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LeadTrendChartProps {
  data: { week: string; leads: number }[];
}

export function LeadTrendChart({ data }: LeadTrendChartProps) {
  const total = data.reduce((sum, d) => sum + d.leads, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Neue Leads</h3>
        <p className="text-sm text-muted-foreground">
          {total} Leads in den letzten 8 Wochen
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Noch keine Daten vorhanden
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [`${value} Leads`, "Neue Leads"]}
                  labelFormatter={(label) => `KW ab ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  name="Leads"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
