import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  Info,
  LayoutDashboard,
  Menu,
  Radar,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, USE_REAL_API } from "@/constants";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { StatusBadge } from "@/components/common/Badges";
import { useSystemStatus } from "@/hooks/useNids";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/monitoring", label: "Live Monitoring", icon: Activity },
  { to: "/detections", label: "Detections", icon: Radar },
  { to: "/explainability", label: "Explainability", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/about", label: "About", icon: Info },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: status } = useSystemStatus();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
          <div>
            <p className="font-mono text-sm font-semibold tracking-tight text-sidebar-foreground">
              {APP_NAME}
            </p>
            <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
              Frequency-domain XAI NIDS
            </p>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1.5 border-t border-sidebar-border px-3 py-3">
          <ConnectionStatus
            label="Backend"
            state={status?.backendConnected ? "connected" : "disconnected"}
          />
          <ConnectionStatus
            label="Stream"
            state={status?.streaming ? "connected" : "disconnected"}
          />
          <p className="pt-1 font-mono text-[10px] text-muted-foreground">
            {status?.modelVersion ?? "model: unknown"}
          </p>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
          <button
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!USE_REAL_API && <StatusBadge label="Demo / Mock Data" tone="warning" />}
            {actions}
          </div>
        </header>
        <main className="flex-1 space-y-4 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
