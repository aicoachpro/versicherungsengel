import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-6xl font-bold text-muted-foreground/30">404</p>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Seite nicht gefunden</h1>
          <p className="text-sm text-muted-foreground">
            Die angeforderte Seite existiert nicht oder wurde verschoben.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-background px-2.5 h-8 text-sm font-medium shadow-sm shadow-black/[0.03] hover:bg-muted hover:text-foreground transition-all dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
        >
          <Home className="size-4" />
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
