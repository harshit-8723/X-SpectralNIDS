import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { MetricCard } from "@/components/common/MetricCard";
import { StatCard } from "@/components/common/StatCard";
import { AwaitingBackend, ErrorState, LoadingState } from "@/components/common/States";
import { TrafficChart } from "@/components/charts/TrafficChart";
import { AttackDistributionChart } from "@/components/charts/AttackDistributionChart";
import { TIME_WINDOWS } from "@/constants";
import {
  useAttackDistribution,
  useExplanationComparison,
  useModelComparison,
  useSummary,
  useTraffic,
} from "@/hooks/useNids";
import { formatMetric, formatMs, formatNumber, formatPercent } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Detection performance, time-domain vs frequency-domain comparison, explanation metrics, attack distribution and traffic trends.",
      },
      { property: "og:title", content: "Analytics — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Research analytics dashboard for frequency-domain intrusion detection.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [windowSeconds, setWindowSeconds] = useState<number>(900);
  const summary = useSummary();
  const models = useModelComparison();
  const explanations = useExplanationComparison();
  const distribution = useAttackDistribution();
  const traffic = useTraffic(windowSeconds);

  const best = models.data?.at(-1)?.performance;

  return (
    <AppShell
      title="Analytics"
      subtitle="Model performance, explanation metrics and traffic trends across the evaluated dataset"
    >
      <Panel
        title="Detection Performance"
        description="Metrics for the current time + frequency-domain XGBoost configuration"
      >
        {models.isLoading ? (
          <LoadingState />
        ) : models.isError ? (
          <ErrorState message={(models.error as Error).message} onRetry={models.refetch} />
        ) : !best ? (
          <AwaitingBackend what="model evaluation results" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Accuracy" value={best.accuracy} />
            <MetricCard label="Precision" value={best.precision} />
            <MetricCard label="Recall" value={best.recall} />
            <MetricCard label="F1" value={best.f1} />
            <MetricCard label="False Positive Rate" value={best.falsePositiveRate} />
          </div>
        )}
      </Panel>

      <Panel
        title="Detection Approach Comparison"
        description="Time-domain features only vs time + frequency-domain features"
      >
        {models.isLoading ? (
          <LoadingState />
        ) : !models.data?.length ? (
          <AwaitingBackend what="approach comparison results" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Approach</th>
                  <th className="py-2 pr-3 font-medium">Accuracy</th>
                  <th className="py-2 pr-3 font-medium">Precision</th>
                  <th className="py-2 pr-3 font-medium">Recall</th>
                  <th className="py-2 pr-3 font-medium">F1</th>
                  <th className="py-2 font-medium">FPR</th>
                </tr>
              </thead>
              <tbody>
                {models.data.map((m) => (
                  <tr key={m.model} className="border-b border-border/60">
                    <td className="py-2 pr-3">{m.model}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.performance.accuracy)}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.performance.precision)}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.performance.recall)}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.performance.f1)}</td>
                    <td className="tabular py-2">
                      {formatMetric(m.performance.falsePositiveRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Explanation Comparison"
        description="Raw SHAP vs Zone-SHAP — values are reported as measured; no method is asserted to be superior"
      >
        {explanations.isLoading ? (
          <LoadingState />
        ) : explanations.isError ? (
          <ErrorState
            message={(explanations.error as Error).message}
            onRetry={explanations.refetch}
          />
        ) : !explanations.data ? (
          <AwaitingBackend what="explanation experiment results" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Faithfulness</th>
                  <th className="py-2 pr-3 font-medium">Stability</th>
                  <th className="py-2 pr-3 font-medium">Compactness</th>
                  <th className="py-2 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Raw SHAP", explanations.data.raw],
                    ["Zone-SHAP", explanations.data.zone],
                  ] as const
                ).map(([name, m]) => (
                  <tr key={name} className="border-b border-border/60">
                    <td className="py-2 pr-3">{name}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.faithfulness)}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.stability)}</td>
                    <td className="tabular py-2 pr-3">{formatMetric(m.compactness, 0)}</td>
                    <td className="tabular py-2">{formatMs(m.latencyMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Traffic Analyzed"
          value={summary.data ? formatNumber(summary.data.totalTrafficAnalyzed) : "—"}
          loading={summary.isLoading}
        />
        <StatCard
          label="Detection Rate"
          value={summary.data ? formatPercent(summary.data.detectionRate) : "—"}
          tone="attack"
          loading={summary.isLoading}
        />
        <StatCard
          label="Avg Detection Latency"
          value={summary.data ? formatMs(summary.data.avgDetectionLatencyMs) : "—"}
          tone="info"
          loading={summary.isLoading}
        />
        <StatCard
          label="Avg Explanation Latency"
          value={summary.data ? formatMs(summary.data.avgExplanationLatencyMs) : "—"}
          tone="research"
          loading={summary.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Attack Distribution" description="Detected attack categories">
          {distribution.isLoading ? (
            <LoadingState />
          ) : distribution.isError ? (
            <ErrorState
              message={(distribution.error as Error).message}
              onRetry={distribution.refetch}
            />
          ) : !distribution.data?.length ? (
            <AwaitingBackend what="attack distribution data" />
          ) : (
            <AttackDistributionChart data={distribution.data} />
          )}
        </Panel>

        <Panel
          title="Detection Trends"
          description="Normal vs suspicious volume over the selected window"
          actions={
            <div className="flex gap-1">
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
          }
        >
          {traffic.isLoading ? (
            <LoadingState />
          ) : traffic.isError ? (
            <ErrorState message={(traffic.error as Error).message} onRetry={traffic.refetch} />
          ) : (
            <TrafficChart data={traffic.data ?? []} height={240} />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
