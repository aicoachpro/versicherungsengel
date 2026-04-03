"use client";

import { useState } from "react";
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
  Cell,
} from "recharts";

interface RevenueDataPoint {
  month: string;
  rawMonth: string;
  umsatz: number;
  kosten: number;
  ueberschuss: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const compactFormatter = new Intl.NumberFormat("de-DE", {
  notation: "compact",
  compactDisplay: "short",
});

export function RevenueChart({ data }: RevenueChartProps) {
  const [view, setView] = useState<"month" | "all">("month");

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const displayData = view === "month"
    ? data.filter((d) => d.rawMonth === currentMonth)
    : data;

  const hasData = displayData.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Umsatz, Kosten & Überschuss</h3>
            <p className="text-sm text-muted-foreground">
              {view === "month" ? "Aktueller Monat" : "Alle Monate"}
            </p>
          </div>
          <div className="flex items-center rounded-lg bg-muted p-1">
            <button
              onClick={() => setView("month")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monat
            </button>
            <button
              onClick={() => setView("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                view === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gesamt
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(v) => compactFormatter.format(v)}
                />
                <Tooltip
                  formatter={(value) => currencyFormatter.format(Number(value))}
                />
                <Legend />
                <Bar
                  dataKey="kosten"
                  name="Kosten"
                  fill="var(--color-chart-2)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="umsatz"
                  name="Umsatz"
                  fill="var(--color-chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="ueberschuss"
                  name="Überschuss"
                  radius={[4, 4, 0, 0]}
                >
                  {displayData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.ueberschuss >= 0 ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Keine Daten für diesen Monat
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
