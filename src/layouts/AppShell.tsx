import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDot,
  Coins,
  LayoutDashboard,
  Newspaper,

  Settings as SettingsIcon,
  TerminalSquare,
} from "lucide-react";
import type { ReactNode } from "react";

import { apiStatusQuery } from "@/services/marketService";
import { useSettingsStore } from "@/stores/settingsStore";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/calendar", label: "Economic Calendar", icon: CalendarDays },
  { to: "/gold", label: "Gold Analysis", icon: Coins },
  { to: "/news", label: "Breaking News", icon: Newspaper },
  { to: "/api-explorer", label: "API Explorer", icon: TerminalSquare },

  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function StatusPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-1">
      <CircleDot className={ok ? "size-3 text-bull" : "size-3 text-warn"} aria-hidden />
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: status } = useQuery(apiStatusQuery());
  const directMode = useSettingsStore((s) => s.directMode);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" aria-hidden />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Forex Market Intelligence
            </span>
          </div>
          <span className="rounded border border-sim-foreground/40 bg-sim/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-sim-foreground">
            {directMode ? "Direct feed · real data" : "Scrapper API"}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <StatusPill label="Feed" value={status?.scraperConnected ? "FF + MetalsMine" : "Offline"} ok={Boolean(status?.scraperConnected)} />
            <Link to="/settings"><StatusPill label="AI" value={status?.aiConnected ? status.aiProvider : "No key"} ok={Boolean(status?.aiConnected)} /></Link>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar lg:block">
          <nav className="sticky top-[53px] flex flex-col gap-0.5 p-3">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-sidebar-accent/50" }}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-sidebar px-3 py-2 lg:hidden">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          <main className="mx-auto max-w-[1400px] space-y-6 p-4 lg:p-6">{children}</main>

          <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground lg:px-6">
            <div className="flex items-center gap-2">
              <Activity className="size-3.5" aria-hidden />
              {directMode
                ? "Direct feed — calendar (Forex Factory + MetalsMine), XAUUSD price (Binance PAXG/USDT) and news are real; only what-if releases are local. Not advice."
                : "Scrapper API mode — data comes from your scrapper server. Not advice."}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
