import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";

const PHASE_NAMES = [
  "Termin eingegangen",
  "Termin stattgefunden",
  "Follow-up",
  "Angebot erstellt",
  "Abgeschlossen",
  "Verloren",
];

export default function PipelineLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Sales Pipeline" />
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-[120px] rounded-md" />
          <Skeleton className="h-9 w-[100px] rounded-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 min-w-max">
          {PHASE_NAMES.map((phase) => (
            <div key={phase} className="w-72 flex-shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-5 w-6 rounded-full" />
              </div>
              <div className="space-y-3 min-h-[200px] rounded-xl bg-muted/40 p-2 border border-border/50">
                {Array.from({ length: Math.floor(Math.random() * 2) + 1 }).map((_, j) => (
                  <div key={j} className="rounded-xl bg-card p-3 shadow-sm ring-1 ring-black/[0.06] space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-4 w-4 shrink-0" />
                    </div>
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
