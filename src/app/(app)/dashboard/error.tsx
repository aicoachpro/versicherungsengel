"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Dashboard konnte nicht geladen werden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Beim Laden des Dashboards ist ein Fehler aufgetreten. Bitte versuche
            es erneut.
          </p>
          {isDev && error.message && (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="size-4" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
