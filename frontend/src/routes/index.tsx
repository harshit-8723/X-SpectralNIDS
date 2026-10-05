import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, Gauge, Radar, ShieldAlert, Timer } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from "@/components/common/States";
import { TrafficChart } from "@/components/charts/TrafficChart";
import { AttackDistributionChart } from "@/components/charts/AttackDistributionChart";
import { DetectionsTable } from "@/components/detections/DetectionsTable";
import { ZoneSummary } from "@/components/explainability/ZoneSummary";
import { TIME_WINDOWS } from "@/constants";
import {
  useAttackDistribution,
  useLatestDetections,
  useSummary,
  useTraffic,
} from "@/hooks/useNids";
import { formatMs, formatNumber, formatPercent } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOC Overview — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Security operations overview for X-SpectralNIDS: traffic trends, attack distribution, latest detections and zone-grouped SHAP summaries.",
      },
      { property: "og:title", content: "SOC Overview — X-SpectralNIDS" },
      {
        property: "og:description",
        content:
          "Traffic trends, attack distribution and explainable AI summaries for frequency-domain network intrusion detection.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const [windowSeconds, setWindowSeconds] = useState<number>(300);
  const summary = useSummary();
  const traffic = useTraffic(windowSeconds);
  const distribution = useAttackDistribution();
  const latest = useLatestDetections(8);

  const s = summary.data;

  return (
    <AppShell title="SOC Overview" subtitle="Detection, traffic and explainability at a glance">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Traffic Analyzed"
          value={s ? formatNumber(s.totalTrafficAnalyzed) : "—"}
          hint="flows"
          icon={Activity}
          loading={summary.isLoading}
          source="GET /api/analytics/summary"
        />
        <StatCard
          label="Total Alerts"
          value={s ? formatNumber(s.totalAlerts) : "—"}
          icon={AlertTriangle}
          tone="warning"
          loading={summary.isLoading}
        />
        <StatCard
          label="Detection Rate"
          value={s ? formatPercent(s.detectionRate) : "—"}
          hint="attack / total"
          icon={Radar}
          tone="info"
          loading={summary.isLoading}
        />
        <StatCard
          label="Active Threats"
          value={s ? formatNumber(s.activeThreats) : "—"}
          hint="high + critical"
          icon={ShieldAlert}
          tone="attack"
          loading={summary.isLoading}
        />
        <StatCard
          label="Detection Latency"
          value={s ? formatMs(s.avgDetectionLatencyMs) : "—"}
          icon={Timer}
          loading={summary.isLoading}
        />
        <StatCard
          label="Explanation Latency"
          value={s ? formatMs(s.avgExplanationLatencyMs) : "—"}
          icon={Gauge}
          tone="research"
          loading={summary.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Traffic Overview"
          description="Normal vs suspicious flows. Structured to accept live WebSocket updates."
          actions={
            <div className="flex gap-1">
              {TIME_WINDOWS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWindowSeconds(w.value)}
                  className={cn(
                    "rounded border px-2 py-1 text-[11px]",
                    windowSeconds === w.value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          }
        >
          {traffic.isLoading ? (
            <LoadingState label="Loading traffic window…" />
          ) : traffic.isError ? (
            <ErrorState message={(traffic.error as Error).message} onRetry={traffic.refetch} />
          ) : (
            <TrafficChart data={traffic.data ?? []} />
          )}
        </Panel>

        <Panel title="Attack Distribution" description="Categories observed in the current dataset">
          {distribution.isLoading ? (
            <LoadingState />
          ) : distribution.isError ? (
            <ErrorState
              message={(distribution.error as Error).message}
              onRetry={distribution.refetch}
            />
          ) : (distribution.data ?? []).length === 0 ? (
            <EmptyState message="No attacks recorded in this dataset." />
          ) : (
            <AttackDistributionChart data={distribution.data ?? []} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Latest Detections"
          description="Select a row to open the investigation view"
          actions={
            <Link to="/detections" className="text-xs text-info hover:underline">
              View all
            </Link>
          }
        >
          {latest.isLoading ? (
            <SkeletonRows rows={6} />
          ) : latest.isError ? (
            <ErrorState message={(latest.error as Error).message} onRetry={latest.refetch} />
          ) : (latest.data ?? []).length === 0 ? (
            <EmptyState message="No detections found." />
          ) : (
            <DetectionsTable detections={latest.data ?? []} />
          )}
        </Panel>

        <Panel
          title="Zone-SHAP Summary"
          description="Top frequency zones for the most recent detection"
        >
          <ZoneSummary detectionId={latest.data?.[0]?.id} />
        </Panel>
      </div>
    </AppShell>
  );
}
