import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PipelineFunnelProps {
  data: { phase: string; count: number }[];
}

const phaseColors: Record<string, { bg: string; text: string }> = {
  "Termin eingegangen": { bg: "bg-blue-500", text: "text-blue-700" },
  "Termin stattgefunden": { bg: "bg-sky-500", text: "text-sky-700" },
  "Follow-up": { bg: "bg-amber-500", text: "text-amber-700" },
  "Angebot erstellt": { bg: "bg-purple-500", text: "text-purple-700" },
  "Abgeschlossen": { bg: "bg-emerald-500", text: "text-emerald-700" },
  "Verloren": { bg: "bg-red-400", text: "text-red-700" },
};

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  // Trichter: Breite proportional zur Phase-Reihenfolge (breit → schmal)
  const funnelData = data.filter((d) => d.phase !== "Verloren");
  const verloren = data.find((d) => d.phase === "Verloren");

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Conversion Funnel</h3>
        <p className="text-sm text-muted-foreground">
          {total} Leads gesamt
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {funnelData.map((item, i) => {
            const widthPercent = 100 - (i * (60 / Math.max(funnelData.length - 1, 1)));
            const colors = phaseColors[item.phase] || { bg: "bg-primary", text: "text-primary" };
            return (
              <Link
                key={item.phase}
                href={`/pipeline?scrollToPhase=${encodeURIComponent(item.phase)}`}
                className="block group"
              >
                <div
                  className={`${colors.bg} mx-auto rounded-md py-2 px-3 flex items-center justify-between transition-all group-hover:opacity-80`}
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className="text-xs font-medium text-white truncate">
                    {item.phase}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {item.count}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        {verloren && verloren.count > 0 && (
          <Link
            href="/pipeline?scrollToPhase=Verloren"
            className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {verloren.count} Verloren
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
