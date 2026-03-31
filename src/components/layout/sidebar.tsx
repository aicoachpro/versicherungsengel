"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Kanban,
  FileText,
  Settings,
  Shield,
  Users,
  Menu,
  X,
  Archive,
  CalendarClock,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/wiedervorlage", label: "Wiedervorlage", icon: CalendarClock },
  { href: "/versicherungen", label: "Versicherungen", icon: FileText },
  { href: "/archiv", label: "Archiv", icon: Archive },
];

const adminNav = [
  { href: "/nutzer", label: "Nutzer", icon: Users },
  { href: "/audit-log", label: "Audit-Log", icon: ClipboardList },
];

const settingsNav = [
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", isActive && "text-gold")} />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-1.5 hover:bg-sidebar-accent"
          aria-label="Menü öffnen"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded" />
        <span className="text-sm font-semibold tracking-tight">VÖLKER Finance</span>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed z-50 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <Image
            src="/logo.png"
            alt="VÖLKER Finance OHG"
            width={44}
            height={44}
            className="rounded-xl"
          />
          <div>
            <p className="text-sm font-semibold leading-tight tracking-tight">VÖLKER Finance</p>
            <p className="text-[11px] text-sidebar-foreground/40 font-medium tracking-wide uppercase">Sales Hub</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          {isAdmin && (
            <>
              <div className="my-4 mx-3 border-t border-sidebar-border" />
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                Admin
              </p>
              <div className="space-y-1">
                {adminNav.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </>
          )}

          <div className="my-4 mx-3 border-t border-sidebar-border" />
          <div className="space-y-1">
            {settingsNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/30 font-medium">
            <Shield className="h-3.5 w-3.5" />
            Allianz Generalvertretung
          </div>
        </div>
      </aside>
    </>
  );
}
