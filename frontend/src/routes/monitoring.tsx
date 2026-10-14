import { useEffect, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { EmptyState } from "@/components/common/States";
import { PredictionBadge, SeverityBadge, StatusBadge } from "@/components/common/Badges";
import { TrafficChart } from "@/components/charts/TrafficChart";
import { SpectrumChart } from "@/components/charts/SpectrumChart";
import { useMonitoringStream } from "@/hooks/useMonitoringStream";
import { useReplayControls, useSystemStatus } from "@/hooks/useNids";
import { formatNumber, formatPercent, formatTime } from "@/utils/format";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Live Monitoring — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Real-time SOC console: connection health, live traffic, FFT frequency spectrum and a streaming detection feed.",
      },
      { property: "og:title", content: "Live Monitoring — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Real-time traffic, frequency spectrum and detection feed for X-SpectralNIDS.",
      },
    ],
  }),
  component: Monitoring,
});

function Monitoring() {
  const { state, messages } = useMonitoringStream();
  const latestMessage = messages[0];
  const latestExplanation = latestMessage?.explanations.at(-1);
  const status = useSystemStatus(2000);
  const replay = useReplayControls();
  const autoStartAttempted = useRef(false);

  useEffect(() => {
    if (state !== "connected" || autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    replay.start.mutate();
  }, [state, replay.start]);

  const livePoints = useMemo(
    () => [...messages].reverse().map((m) => m.traffic),
    [messages],
  );

  const liveSpectrum = latestMessage?.frequency ?? [];
  const dominant = useMemo(() => {
    if (!liveSpectrum.length) return undefined;
    return liveSpectrum.reduce((a, b) => (b.magnitude > a.magnitude ? b : a)).frequency;
  }, [liveSpectrum]);

  const last = livePoints.at(-1);
  const feedItems = messages.flatMap((m) => (m.detection ? [m.detection] : []));
  const streaming = Boolean(status.data?.streaming);

  return (
    <AppShell
      title="Live Monitoring"
      subtitle="CICIDS2017 flow replay through the trained model — not mock dashboard data"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-info/50 bg-info/10 px-2 py-1 text-[11px] text-info hover:bg-info/20"
            disabled={replay.start.isPending || streaming}
            onClick={() => replay.start.mutate()}
          >
            {streaming ? "Replay running" : "Start replay"}
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
            disabled={replay.stop.isPending || !streaming}
            onClick={() => replay.stop.mutate()}
          >
            Stop
          </button>
        </div>
      }
    >
      <Panel title="Connection Status">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <ConnectionStatus
            label="Backend"
            state={status.data?.backendConnected ? "connected" : "disconnected"}
          />
          <ConnectionStatus label="WebSocket" state={state} />
          <ConnectionStatus
            label="Streaming"
            state={streaming ? "connected" : "disconnected"}
          />
          {latestMessage && (
            <span className="font-mono text-[11px] text-muted-foreground">
              Model: {latestMessage.meta.model_name}
            </span>
          )}
          {latestMessage?.meta.is_dummy && <StatusBadge label="Dummy model" tone="warning" />}
          {latestMessage && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {`${latestMessage.predictions.length} rows · ${latestMessage.latency.total_ms.toFixed(1)} ms`}
            </span>
          )}
          {latestMessage?.lagging && <StatusBadge label="Lagging" tone="warning" />}
          <span className="font-mono text-[11px] text-muted-foreground">
            {status.data?.wsUrl}
          </span>
          {latestExplanation?.raw.is_stub && (
            <StatusBadge label="Raw explanation stub" tone="warning" />
          )}
          {latestExplanation?.zone.is_stub && (
            <StatusBadge label="Zone explanation stub" tone="warning" />
          )}
          {state !== "connected" && (
            <StatusBadge
              label={
                state === "reconnecting" || state === "connecting"
                  ? "Connecting to live monitoring…"
                  : "Backend stream unavailable — start the FastAPI server on port 8000"
              }
              tone="warning"
            />
          )}
          {replay.start.isError && (
            <StatusBadge
              label={(replay.start.error as Error).message || "Replay failed to start"}
              tone="warning"
            />
          )}
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Flows / tick"
          value={last ? formatNumber(last.normal + last.suspicious) : "—"}
        />
        <StatCard
          label="Throughput"
          value={
            last?.throughputMbps == null ? "unavailable" : `${last.throughputMbps.toFixed(1)} Mbps`
          }
          tone="info"
        />
        <StatCard
          label="Normal Traffic"
          value={last ? formatNumber(last.normal) : "—"}
          tone="normal"
        />
        <StatCard
          label="Suspicious Traffic"
          value={last ? formatNumber(last.suspicious) : "—"}
          tone="attack"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Live Traffic" description="Rolling window of replayed CICIDS2017 flows">
          {livePoints.length === 0 ? (
            <EmptyState message="Waiting for replay ticks. Click Start replay if the backend is running." />
          ) : (
            <TrafficChart data={livePoints} height={240} />
          )}
        </Panel>

        <Panel
          title="Frequency Spectrum"
          description={
            dominant !== undefined
              ? `Dominant feature-vector FFT bin ${dominant.toFixed(0)} · dimensionless index`
              : "Feature-vector FFT bins; not a packet/flow-time spectrum"
          }
        >
          {liveSpectrum.length === 0 ? (
            <EmptyState message="Spectrum appears once Model B emits FFT magnitude bins." />
          ) : (
            <SpectrumChart
              data={liveSpectrum}
              {...(dominant !== undefined ? { dominantBin: dominant } : {})}
            />
          )}
        </Panel>
      </div>

      <Panel title="Live Detection Feed" description="Newest events appear first">
        {feedItems.length === 0 ? (
          <EmptyState message="No attack predictions in the current replay window yet." />
        ) : (
          <ul className="divide-y divide-border/60">
            {feedItems.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-xs animate-in fade-in"
              >
                <span className="tabular w-20 text-muted-foreground">
                  {formatTime(d.timestamp)}
                </span>
                <span className="tabular font-mono">{d.source?.trim() || "unavailable"}</span>
                <span className="text-muted-foreground">→</span>
                <span className="tabular font-mono">{d.destination?.trim() || "unavailable"}</span>
                <span>{d.attackType}</span>
                <PredictionBadge prediction={d.prediction} />
                <span className="tabular">{formatPercent(d.confidence)}</span>
                <SeverityBadge severity={d.severity} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
