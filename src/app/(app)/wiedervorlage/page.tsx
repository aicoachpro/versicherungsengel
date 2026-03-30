"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ExternalLink, AlertTriangle, Clock, CalendarCheck } from "lucide-react";

interface Lead {
  id: number;
  name: string;
  phase: string;
  ansprechpartner: string | null;
  branche: string | null;
  folgetermin: string | null;
  archivedAt: string | null;
}

export default function WiedervorlagePage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/leads");
    if (res.ok) {
      const all = await res.json();
      setLeads(
        all
          .filter((l: Lead) => l.folgetermin && !l.archivedAt)
          .sort((a: Lead, b: Lead) => new Date(a.folgetermin!).getTime() - new Date(b.folgetermin!).getTime())
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const overdue = leads.filter((l) => new Date(l.folgetermin!) < todayStart);
  const today = leads.filter((l) => {
    const d = new Date(l.folgetermin!);
    return d >= todayStart && d < todayEnd;
  });
  const thisWeek = leads.filter((l) => {
    const d = new Date(l.folgetermin!);
    return d >= todayEnd && d < weekEnd;
  });
  const later = leads.filter((l) => new Date(l.folgetermin!) >= weekEnd);

  function LeadGroup({ title, items, icon: Icon, variant }: {
    title: string;
    items: Lead[];
    icon: React.ElementType;
    variant: "destructive" | "warning" | "default" | "secondary";
  }) {
    if (items.length === 0) return null;

    const badgeClass = variant === "destructive"
      ? "bg-red-100 text-red-800"
      : variant === "warning"
        ? "bg-amber-100 text-amber-800"
        : variant === "default"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-800";

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${variant === "destructive" ? "text-red-500" : variant === "warning" ? "text-amber-500" : "text-muted-foreground"}`} />
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge className={badgeClass}>{items.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/pipeline/${lead.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{lead.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {lead.ansprechpartner && <span>{lead.ansprechpartner}</span>}
                    {lead.branche && <span>· {lead.branche}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {new Date(lead.folgetermin!).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">{lead.phase}</Badge>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Wiedervorlage" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Laden...</p>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Keine Wiedervorlagen</p>
            <p className="text-sm mt-1">Sobald Leads einen Folgetermin haben, erscheinen sie hier</p>
          </div>
        ) : (
          <>
            <LeadGroup title="Überfällig" items={overdue} icon={AlertTriangle} variant="destructive" />
            <LeadGroup title="Heute" items={today} icon={Clock} variant="warning" />
            <LeadGroup title="Diese Woche" items={thisWeek} icon={CalendarDays} variant="default" />
            <LeadGroup title="Später" items={later} icon={CalendarCheck} variant="secondary" />
          </>
        )}
      </div>
    </div>
  );
}
