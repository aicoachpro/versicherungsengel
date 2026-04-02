"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut, useSession } from "next-auth/react";
import { NotificationBell } from "@/components/layout/notification-bell";

export function Header({ title, actions }: { title: string; actions?: React.ReactNode }) {
  const { data: session } = useSession();
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background/70 backdrop-blur-xl px-4 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight text-foreground truncate mr-2">{title}</h1>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions}
        <NotificationBell />
        <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-2.5 py-1 hover:bg-accent transition-all duration-200 cursor-pointer outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-gradient-to-b from-primary to-primary/80 text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:inline">{session?.user?.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
