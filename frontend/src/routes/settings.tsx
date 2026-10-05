import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/Badges";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { useSystemStatus } from "@/hooks/useNids";
import { API_BASE_URL, TIME_WINDOWS, USE_REAL_API, WS_BASE_URL } from "@/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Configure refresh interval, dashboard window, backend and WebSocket endpoints, detection threshold and default explanation method.",
      },
      { property: "og:title", content: "Settings — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Runtime preferences and system information for the X-SpectralNIDS console.",
      },
    ],
  }),
  component: SettingsPage,
});

const REFRESH_OPTIONS = [10, 30, 60, 300];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function SettingsPage() {
  const { data: status, isLoading } = useSystemStatus();
  const [refresh, setRefresh] = useState(30);
  const [windowSeconds, setWindowSeconds] = useState<number>(900);
  const [threshold, setThreshold] = useState(0.5);
  const [method, setMethod] = useState<"raw" | "zone">("zone");

  return (
    <AppShell
      title="Settings"
      subtitle="Console preferences and backend configuration — applied to this session only"
    >
      <Panel title="General" description="Dashboard refresh and default time range">
        <div className="space-y-4">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Refresh interval
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {REFRESH_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setRefresh(s)}
                  className={cn(
                    "rounded border px-2 py-1 text-[11px]",
                    refresh === s
                      ? "border-info/50 bg-info/10 text-info"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s < 60 ? `${s}s` : `${s / 60}m`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Dashboard time range
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {TIME_WINDOWS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWindowSeconds(w.value)}
                  className={cn(
                    "rounded border px-2 py-1 text-[11px]",
                    windowSeconds === w.value
                      ? "border-info/50 bg-info/10 text-info"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Theme</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The console ships with a fixed dark SOC theme; light mode is not supported yet.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Monitoring" description="Backend and streaming endpoints">
        <div className="space-y-3">
          <Row label="API base URL" value={API_BASE_URL} />
          <Row label="WebSocket URL" value={WS_BASE_URL} />
          <Row label="Data source" value={USE_REAL_API ? "Live backend" : "Mock adapter"} />
          <div className="flex flex-wrap gap-3 pt-1">
            <ConnectionStatus
              label="Backend"
              state={status?.backendConnected ? "connected" : "disconnected"}
            />
            <ConnectionStatus
              label="Stream"
              state={status?.streaming ? "connected" : "disconnected"}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Automatic reconnection with exponential backoff is handled by the monitoring socket
            and is always enabled.
          </p>
        </div>
      </Panel>

      <Panel title="Detection" description="Client-side triage threshold">
        <label className="block text-xs text-muted-foreground">
          Confidence threshold: <span className="tabular text-foreground">{threshold.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-2 w-full max-w-md"
          />
        </label>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Server-side thresholding is applied by the model pipeline; this preference only affects
          how results are highlighted in this session.
        </p>
      </Panel>

      <Panel title="Explainability" description="Default explanation method for detail views">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["raw", "Raw SHAP"],
              ["zone", "Zone-SHAP"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMethod(value)}
              className={cn(
                "rounded border px-2 py-1 text-[11px]",
                method === value
                  ? "border-research/50 bg-research/10 text-research"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Both methods remain available on every detection; this only selects which one is shown
          first.
        </p>
      </Panel>

      <Panel title="System" description="Runtime information">
        <div className="space-y-1">
          <Row
            label="Backend status"
            value={
              isLoading ? "checking…" : status?.backendConnected ? "connected" : "disconnected"
            }
          />
          <Row label="Model version" value={status?.modelVersion ?? "unknown"} />
          <Row label="Mode" value={USE_REAL_API ? "Live" : "Demo / mock data"} />
        </div>
        {!USE_REAL_API && (
          <div className="mt-3">
            <StatusBadge label="Demo / Mock Data" tone="warning" />
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
