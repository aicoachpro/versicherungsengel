import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Briefcase, Building2, HelpCircle } from "lucide-react";

interface GewerbeartOverviewProps {
  data: { gewerbeart: string; anzahl: number; umsatz: number; kosten: number }[];
}

export function GewerbeartChart({ data }: GewerbeartOverviewProps) {
  const haupt = data.find((d) => d.gewerbeart === "Hauptberuflich");
  const neben = data.find((d) => d.gewerbeart === "Nebenberuflich");
  const unbekannt = data.find((d) => d.gewerbeart === "Nicht angegeben");
  const total = (haupt?.anzahl ?? 0) + (neben?.anzahl ?? 0) + (unbekannt?.anzahl ?? 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Leads nach Gewerbeart</h3>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "Lead" : "Leads"} gesamt
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Noch keine Leads vorhanden
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Briefcase className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Hauptberuflich</span>
              </div>
              <span className="text-xl font-bold">{haupt?.anzahl ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Nebenberuflich</span>
              </div>
              <span className="text-xl font-bold">{neben?.anzahl ?? 0}</span>
            </div>
            {(unbekannt?.anzahl ?? 0) > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <span className="text-sm text-muted-foreground">Nicht angegeben</span>
                </div>
                <span className="text-xl font-bold text-muted-foreground">{unbekannt?.anzahl ?? 0}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
