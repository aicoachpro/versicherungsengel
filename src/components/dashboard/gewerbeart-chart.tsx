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

interface GewerbeartChartProps {
  data: { gewerbeart: string; anzahl: number; umsatz: number; kosten: number }[];
}

export function GewerbeartChart({ data }: GewerbeartChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Haupt- vs. Nebenberuflich</h3>
        <p className="text-sm text-muted-foreground">Leads, Umsatz & Kosten nach Gewerbeart</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="gewerbeart" />
              <YAxis
                tickFormatter={(v) =>
                  new Intl.NumberFormat("de-DE", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                formatter={(value, name) => [
                  name === "anzahl"
                    ? `${value} Leads`
                    : new Intl.NumberFormat("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      }).format(Number(value)),
                  name === "anzahl" ? "Leads" : name === "umsatz" ? "Umsatz" : "Kosten",
                ]}
              />
              <Legend />
              <Bar dataKey="anzahl" name="Leads" fill="#003781" radius={[4, 4, 0, 0]} />
              <Bar dataKey="umsatz" name="Umsatz" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="kosten" name="Kosten" fill="#c4a035" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
