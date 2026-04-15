"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Kanban,
  FileText,
  Settings,
  Shield,
  Users,
  Menu,
  Archive,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Upload,
  Mail,
  Coins,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/wiedervorlage", label: "Wiedervorlage", icon: CalendarClock },
  { href: "/versicherungen", label: "Versicherungen", icon: FileText },
  { href: "/archiv", label: "Archiv", icon: Archive },
  { href: "/reklamationen", label: "Reklamationen", icon: AlertTriangle },
  { href: "/provisionen", label: "Provisionen", icon: Coins },
  { href: "/import", label: "Lead-Import", icon: Upload },
  { href: "/email-inbox", label: "E-Mail-Eingang", icon: Mail },
];

const adminNav = [
  { href: "/nutzer", label: "Nutzer", icon: Users },
  { href: "/audit-log", label: "Audit-Log", icon: ClipboardList },
];

const settingsNav = [
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

const mobileBottomNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/wiedervorlage", label: "Wiedervorl.", icon: CalendarClock },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const { theme, setTheme, resolvedTheme } = useTheme();
  const branding = useBranding();
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setMounted(true);
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) => {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary")} />
        {label}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <Image src={branding.logo} alt={branding.companyName} width={36} height={36} className="rounded-[10px]" />
        <div>
          <p className="text-[13px] font-semibold leading-tight tracking-tight text-sidebar-foreground">{branding.companyName}</p>
          {branding.subtitle && <p className="text-[11px] text-sidebar-foreground/40 font-medium">{branding.subtitle}</p>}
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
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">Admin</p>
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

      {/* Theme Toggle */}
      {mounted && (
        <div className="mx-3 mb-2 flex items-center rounded-xl bg-sidebar-accent/40 p-1">
          {([
            { value: "light", icon: Sun, label: "Hell" },
            { value: "system", icon: Monitor, label: "Auto" },
            { value: "dark", icon: Moon, label: "Dunkel" },
          ] as const).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all duration-200",
                theme === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/30 font-medium">
          <Shield className="h-3.5 w-3.5" />
          {branding.subtitle || branding.companyName}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* === MOBILE: Top-Bar mit Dropdown-Menue + Bottom-Nav === */}
      {!isDesktop && (
        <>
          {/* Top Bar — Logo, Firmenname, rechts Menue-Button als Dropdown */}
          <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar/80 backdrop-blur-xl px-4 text-sidebar-foreground">
            <Image src={branding.logo} alt="Logo" width={28} height={28} className="rounded" />
            <span className="text-sm font-semibold tracking-tight truncate">{branding.companyName}</span>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Menue oeffnen"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-accent outline-none"
                >
                  <Menu className="h-5 w-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-56 max-h-[70vh]">
                  {[...mainNav, ...(isAdmin ? adminNav : []), ...settingsNav].map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <DropdownMenuItem
                        key={href}
                        onClick={() => router.push(href)}
                        className={cn("gap-2.5 py-2", isActive && "bg-sidebar-accent text-sidebar-accent-foreground")}
                      >
                        <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                        <span className="text-[13px] font-medium">{label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Bottom Nav — schneller Zugriff auf die 4 wichtigsten Seiten */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-sidebar-border bg-sidebar/80 backdrop-blur-xl text-sidebar-foreground">
            {mobileBottomNav.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors", isActive ? "text-primary" : "text-sidebar-foreground/50")}>
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </>
      )}

      {/* === DESKTOP: Sidebar fest im Layout === */}
      {isDesktop && (
        <aside className="relative flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl text-sidebar-foreground flex-shrink-0">
          {sidebarContent}
        </aside>
      )}
    </>
  );
}
