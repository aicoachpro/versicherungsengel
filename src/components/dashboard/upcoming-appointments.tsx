import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Appointment {
  id: number;
  name: string;
  ansprechpartner: string | null;
  termin: string | null;
  phase: string;
  typ: "Termin" | "Folgetermin";
}

export function UpcomingAppointments({ appointments }: { appointments: Appointment[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-lg font-semibold">Anstehende Termine</h3>
        <p className="text-sm text-muted-foreground">Nächste 7 Tage</p>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine anstehenden Termine
          </p>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt, idx) => (
              <div
                key={`${apt.id}-${apt.typ}-${idx}`}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${apt.typ === "Folgetermin" ? "bg-emerald-100" : "bg-primary/10"}`}>
                  {apt.typ === "Folgetermin" ? (
                    <CalendarCheck className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Calendar className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{apt.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {apt.ansprechpartner}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {apt.termin
                      ? new Date(apt.termin).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${apt.typ === "Folgetermin" ? "bg-emerald-100 text-emerald-700" : ""}`}
                  >
                    {apt.typ === "Folgetermin" ? "Cross-Selling" : apt.phase}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
