"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Users, User } from "lucide-react";

interface UserFilterProps {
  isAdmin: boolean;
  showAll: boolean;
}

export function UserFilter({ isAdmin, showAll }: UserFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!isAdmin) return null;

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (showAll) {
      params.set("showAll", "0");
    } else {
      params.delete("showAll");
    }
    router.push(`/dashboard?${params.toString()}`);
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
