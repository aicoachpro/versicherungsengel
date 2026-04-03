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
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Conversion Funnel</h3>
        <p className="text-sm text-muted-foreground">
          {total} Leads gesamt
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Noch keine Daten vorhanden
          </p>
        ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const colors = phaseColors[item.phase] || { bg: "bg-primary", text: "text-primary" };
            return (
              <Link
                key={item.phase}
                href={`/pipeline?scrollToPhase=${encodeURIComponent(item.phase)}`}
                className="flex items-center gap-3 group"
              >
                <span className="w-40 text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
                  {item.phase}
                </span>
                <div className="flex-1">
                  <div className="h-8 rounded-md bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-md ${colors.bg} flex items-center px-3 transition-all group-hover:opacity-80`}
                      style={{
                        width: `${Math.max((item.count / maxCount) * 100, 8)}%`,
                      }}
                    >
                      <span className="text-xs font-medium text-white">
                        {item.count}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
