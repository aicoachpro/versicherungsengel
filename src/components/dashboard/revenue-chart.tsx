"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RevenueChartProps {
  data: { month: string; umsatz: number; kosten: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Umsatz & Kosten</h3>
        <p className="text-sm text-muted-foreground">Letzte Monate</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis
                className="text-xs"
                tickFormatter={(v) =>
                  new Intl.NumberFormat("de-DE", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                formatter={(value) =>
                  new Intl.NumberFormat("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  }).format(Number(value))
                }
              />
              <Legend />
              <Bar
                dataKey="umsatz"
                name="Umsatz"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="kosten"
                name="Kosten"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
