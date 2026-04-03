"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
            <p className="text-sm text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten.
            </p>
          </div>
          {isDev && error.message && (
            <pre className="w-full overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              <RefreshCw className="size-4" />
              Erneut versuchen
            </Button>
            <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
              <Home className="size-4" />
              Zum Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
