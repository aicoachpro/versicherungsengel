import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Activity {
  id: number;
  name: string;
  phase: string;
  updatedAt: string;
}

const phaseBadgeVariant: Record<string, string> = {
  "Abgeschlossen": "bg-emerald-100 text-emerald-800",
  "Verloren": "bg-red-100 text-red-800",
  "Angebot erstellt": "bg-purple-100 text-purple-800",
  "Follow-up": "bg-amber-100 text-amber-800",
  "Termin stattgefunden": "bg-blue-100 text-blue-800",
  "Termin eingegangen": "bg-sky-100 text-sky-800",
};

export function RecentActivity({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Letzte Aktivitäten</h3>
        <p className="text-sm text-muted-foreground">Neueste Lead-Updates</p>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Aktivitäten
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Link
                key={activity.id}
                href={`/pipeline/${activity.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-shadow hover:shadow-sm hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.updatedAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Badge variant="secondary" className={phaseBadgeVariant[activity.phase] || "bg-gray-100 text-gray-800"}>
                  {activity.phase}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
