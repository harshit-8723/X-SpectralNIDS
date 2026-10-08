import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { PredictionBadge, SeverityBadge, StatusBadge } from "@/components/common/Badges";
import { TrafficChart } from "@/components/charts/TrafficChart";
import { SpectrumChart } from "@/components/charts/SpectrumChart";
import { useMonitoringStream } from "@/hooks/useMonitoringStream";
import { useLatestDetections, useLiveSpectrum, useSystemStatus, useTraffic } from "@/hooks/useNids";
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
  const status = useSystemStatus();
  const traffic = useTraffic(60);
  const spectrum = useLiveSpectrum();
  const feed = useLatestDetections(12);

  const livePoints = useMemo(
    () => (messages.length ? [...messages].reverse().map((m) => m.traffic) : (traffic.data ?? [])),
    [messages, traffic.data],
  );

  const liveSpectrum = messages[0]?.frequency ?? spectrum.data ?? [];
  const dominant = useMemo(() => {
    if (!liveSpectrum.length) return undefined;
    return liveSpectrum.reduce((a, b) => (b.magnitude > a.magnitude ? b : a)).frequency;
  }, [liveSpectrum]);

  const last = livePoints.at(-1);
  const feedItems = messages.length
    ? messages.flatMap((m) => (m.detection ? [m.detection] : []))
    : (feed.data ?? []);

  return (
    <AppShell
      title="Live Monitoring"
      subtitle="Streaming console — falls back to the mock dataset while the backend is offline"
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
            state={state === "connected" ? "connected" : "disconnected"}
          />
          <span className="font-mono text-[11px] text-muted-foreground">
            {status.data?.wsUrl}
          </span>
          {state !== "connected" && (
            <StatusBadge
              label={
                state === "reconnecting" || state === "connecting"
                  ? "Reconnecting to live monitoring…"
                  : "Live stream unavailable — showing dataset snapshot"
              }
              tone="warning"
            />
          )}
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Packets / sec"
          value={last ? formatNumber(last.normal + last.suspicious) : "—"}
        />
        <StatCard
          label="Throughput"
          value={last ? `${last.throughputMbps.toFixed(1)} Mbps` : "—"}
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
        <Panel title="Live Traffic" description="60-second rolling window">
          {traffic.isLoading && !messages.length ? (
            <LoadingState />
          ) : traffic.isError && !messages.length ? (
            <ErrorState message={(traffic.error as Error).message} onRetry={traffic.refetch} />
          ) : (
            <TrafficChart data={livePoints} height={240} />
          )}
        </Panel>

        <Panel
          title="Frequency Spectrum"
          description={
            dominant !== undefined
              ? `Dominant frequency ≈ ${dominant.toFixed(2)} Hz · range 0–500 Hz`
              : "FFT magnitude across the current window"
          }
        >
          {spectrum.isLoading && !liveSpectrum.length ? (
            <LoadingState />
          ) : liveSpectrum.length === 0 ? (
            <EmptyState message="No spectrum data available." />
          ) : (
            <SpectrumChart
              data={liveSpectrum}
              {...(dominant !== undefined ? { dominantFrequency: dominant } : {})}
            />
          )}
        </Panel>
      </div>

      <Panel title="Live Detection Feed" description="Newest events appear first">
        {feedItems.length === 0 ? (
          <EmptyState message="No detections received yet." />
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
                <span className="tabular font-mono">{d.source}</span>
                <span className="text-muted-foreground">→</span>
                <span className="tabular font-mono">{d.destination}</span>
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
