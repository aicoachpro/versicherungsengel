"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, User } from "lucide-react";
import { useSessionFilterSync, writeSessionFilter } from "@/hooks/use-session-filter";

interface UserFilterProps {
  isAdmin: boolean;
  showAll: boolean;
}

export function UserFilter({ isAdmin, showAll }: UserFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync: showAll=0 bedeutet "Meine". URL-Param "0" ↔ sessionStorage "0".
  useSessionFilterSync("showAll", searchParams.get("showAll"));

  if (!isAdmin) return null;

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (showAll) {
      params.set("showAll", "0");
      writeSessionFilter("showAll", "0");
    } else {
      params.delete("showAll");
      writeSessionFilter("showAll", null);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Button
      variant={showAll ? "outline" : "default"}
      size="xs"
      onClick={toggle}
      className="gap-1"
    >
      {showAll ? (
        <>
          <Users className="h-3.5 w-3.5" />
          Alle
        </>
      ) : (
        <>
          <User className="h-3.5 w-3.5" />
          Meine
        </>
      )}
    </Button>
  );
}
