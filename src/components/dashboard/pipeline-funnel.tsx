import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PipelineFunnelProps {
  data: { phase: string; count: number }[];
}

const phaseColors: Record<string, string> = {
  "Termin eingegangen": "bg-blue-500",
  "Termin stattgefunden": "bg-blue-400",
  "Follow-up": "bg-amber-500",
  "Angebot erstellt": "bg-purple-500",
  "Abgeschlossen": "bg-emerald-500",
  "Verloren": "bg-red-400",
};

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Pipeline</h3>
        <p className="text-sm text-muted-foreground">Leads nach Phase</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.phase} className="flex items-center gap-3">
              <span className="w-40 text-sm text-muted-foreground truncate">
                {item.phase}
              </span>
              <div className="flex-1">
                <div className="h-8 rounded-md bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-md ${phaseColors[item.phase] || "bg-primary"} flex items-center px-3 transition-all`}
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
