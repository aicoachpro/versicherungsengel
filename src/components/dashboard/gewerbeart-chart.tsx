import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Briefcase, Building2 } from "lucide-react";

interface GewerbeartOverviewProps {
  data: { gewerbeart: string; anzahl: number; umsatz: number; kosten: number }[];
}

export function GewerbeartChart({ data }: GewerbeartOverviewProps) {
  const haupt = data.find((d) => d.gewerbeart === "Hauptberuflich");
  const neben = data.find((d) => d.gewerbeart === "Nebenberuflich");
  const total = (haupt?.anzahl ?? 0) + (neben?.anzahl ?? 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Leads nach Gewerbeart</h3>
        <p className="text-sm text-muted-foreground">Haupt- vs. Nebenberuflich</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{haupt?.anzahl ?? 0}</p>
              <p className="text-sm text-muted-foreground">Hauptberuflich</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{neben?.anzahl ?? 0}</p>
              <p className="text-sm text-muted-foreground">Nebenberuflich</p>
            </div>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Hauptberuflich</span>
              <span>{total > 0 ? Math.round(((haupt?.anzahl ?? 0) / total) * 100) : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${total > 0 ? ((haupt?.anzahl ?? 0) / total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Nebenberuflich</span>
              <span>{total > 0 ? Math.round(((neben?.anzahl ?? 0) / total) * 100) : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${total > 0 ? ((neben?.anzahl ?? 0) / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {total === 0 && (
          <p className="mt-4 text-sm text-muted-foreground text-center">Noch keine Leads mit Gewerbeart</p>
        )}
      </CardContent>
    </Card>
  );
}
