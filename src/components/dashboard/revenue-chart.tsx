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
  ReferenceLine,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

type ViewMode = "month" | "year" | "all";

const MONTH_NAMES: Record<string, string> = {
  "01": "Januar", "02": "Februar", "03": "März", "04": "April",
  "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
  "09": "September", "10": "Oktober", "11": "November", "12": "Dezember",
};

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const compactFormatter = new Intl.NumberFormat("de-DE", {
  notation: "compact",
  compactDisplay: "short",
});

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(rawMonth: string): string {
  const [year, m] = rawMonth.split("-");
  return `${MONTH_NAMES[m] || m} ${year}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const now = new Date();
  const [view, setView] = useState<ViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(now));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const navigateMonth = (direction: -1 | 1) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setSelectedMonth(getMonthKey(d));
  };

  const navigateYear = (direction: -1 | 1) => {
    setSelectedYear((prev) => prev + direction);
  };

  let displayData: RevenueDataPoint[];
  let subtitle: string;

  if (view === "month") {
    displayData = data.filter((d) => d.rawMonth === selectedMonth);
    subtitle = formatMonthLabel(selectedMonth);
  } else if (view === "year") {
    displayData = data.filter((d) => d.rawMonth.startsWith(String(selectedYear)));
    subtitle = `Jahr ${selectedYear}`;
  } else {
    displayData = data;
    subtitle = "Seit Datenstand";
  }

  const hasData = displayData.length > 0;
  const hasNegative = displayData.some((d) => d.ueberschuss < 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Umsatz, Kosten & Überschuss</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Monat-Navigation */}
            {view === "month" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                  aria-label="Vorheriger Monat"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                  aria-label="Nächster Monat"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* Jahr-Navigation */}
            {view === "year" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateYear(-1)}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                  aria-label="Vorheriges Jahr"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateYear(1)}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                  aria-label="Nächstes Jahr"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* View Toggle */}
            <div className="flex items-center rounded-lg bg-muted p-1">
              {(["month", "year", "all"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    view === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "month" ? "Monat" : mode === "year" ? "Jahr" : "Gesamt"}
                </button>
              ))}
            </div>
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
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-card-foreground)",
                  }}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                />
                <Legend />
                {hasNegative && <ReferenceLine y={0} stroke="var(--border)" />}
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
              Keine Daten für diesen Zeitraum
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
