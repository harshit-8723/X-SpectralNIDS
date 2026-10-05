import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { MetricCard } from "@/components/common/MetricCard";
import { AwaitingBackend, ErrorState, LoadingState } from "@/components/common/States";
import { AttackDistributionChart } from "@/components/charts/AttackDistributionChart";
import {
  useAttackDistribution,
  useExplanationComparison,
  useModelComparison,
  useSummary,
} from "@/hooks/useNids";
import { requestReport, type ReportFormat, type ReportJob } from "@/services/api/reportApi";
import { formatMetric, formatMs, formatNumber, formatPercent } from "@/utils/format";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "detections", label: "Detection summary" },
  { id: "attacks", label: "Attack distribution" },
  { id: "models", label: "Model performance" },
  { id: "explanations", label: "Raw SHAP vs Zone-SHAP" },
  { id: "metrics", label: "Research metrics" },
  { id: "latency", label: "Latency information" },
] as const;

const FORMATS: ReportFormat[] = ["pdf", "csv", "json"];

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Assemble detection summaries, model performance and explanation comparisons into an exportable research report.",
      },
      { property: "og:title", content: "Reports — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Research reporting for frequency-domain explainable intrusion detection.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const summary = useSummary();
  const models = useModelComparison();
  const explanations = useExplanationComparison();
  const distribution = useAttackDistribution();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [selected, setSelected] = useState<string[]>(SECTIONS.map((s) => s.id));
  const [job, setJob] = useState<ReportJob | null>(null);
  const [pending, setPending] = useState(false);

  const best = models.data?.at(-1)?.performance;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function generate() {
    setPending(true);
    setJob(null);
    try {
      const result = await requestReport({
        sections: selected,
        format,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setJob(result);
    } catch (e) {
      setJob({ id: "error", status: "unavailable", message: (e as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell
      title="Reports"
      subtitle="Compose an evidence pack from detections, model performance and explanation analysis"
    >
      <Panel
        title="Report Builder"
        description="Export is handled by the backend report service; without it the request returns unavailable"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ReportFormat)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn(
                  "rounded border px-2 py-1 text-[11px]",
                  selected.includes(s.id)
                    ? "border-info/50 bg-info/10 text-info"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generate}
              disabled={pending || selected.length === 0}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-50"
            >
              {pending ? "Requesting…" : "Generate report"}
            </button>
            {job?.status === "ready" && job.downloadUrl ? (
              <a
                href={job.downloadUrl}
                className="rounded-md border border-normal/40 bg-normal/10 px-3 py-1.5 text-xs text-normal"
              >
                Download report
              </a>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {job?.message ?? "Export becomes available once the backend report service is connected."}
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Detection Summary" description="Figures included in the report preview">
        {summary.isLoading ? (
          <LoadingState />
        ) : summary.isError ? (
          <ErrorState message={(summary.error as Error).message} onRetry={summary.refetch} />
        ) : !summary.data ? (
          <AwaitingBackend what="detection summary data" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Traffic Analyzed
              </p>
              <p className="tabular mt-1 text-xl font-semibold">
                {formatNumber(summary.data.totalTrafficAnalyzed)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Alerts</p>
              <p className="tabular mt-1 text-xl font-semibold">
                {formatNumber(summary.data.totalAlerts)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Detection Rate
              </p>
              <p className="tabular mt-1 text-xl font-semibold">
                {formatPercent(summary.data.detectionRate)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Active Threats
              </p>
              <p className="tabular mt-1 text-xl font-semibold">
                {formatNumber(summary.data.activeThreats)}
              </p>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Attack Distribution" description="Categories observed in the selected range">
          {distribution.isLoading ? (
            <LoadingState />
          ) : !distribution.data?.length ? (
            <AwaitingBackend what="attack distribution data" />
          ) : (
            <AttackDistributionChart data={distribution.data} />
          )}
        </Panel>

        <Panel title="Model Performance" description="Current detection configuration">
          {models.isLoading ? (
            <LoadingState />
          ) : !best ? (
            <AwaitingBackend what="model evaluation results" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Accuracy" value={best.accuracy} />
              <MetricCard label="Precision" value={best.precision} />
              <MetricCard label="Recall" value={best.recall} />
              <MetricCard label="F1" value={best.f1} />
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Raw SHAP vs Zone-SHAP"
        description="Research metrics reported as measured for both explanation methods"
      >
        {explanations.isLoading ? (
          <LoadingState />
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
                    <td className="tabular py-2 pr-3">
                      {m.faithfulness === undefined
                        ? "Awaiting experiment results"
                        : formatMetric(m.faithfulness)}
                    </td>
                    <td className="tabular py-2 pr-3">
                      {m.stability === undefined
                        ? "Awaiting experiment results"
                        : formatMetric(m.stability)}
                    </td>
                    <td className="tabular py-2 pr-3">
                      {m.compactness === undefined
                        ? "Awaiting experiment results"
                        : formatMetric(m.compactness, 0)}
                    </td>
                    <td className="tabular py-2">{formatMs(m.latencyMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Latency" description="End-to-end pipeline timings included in the report">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Avg Detection Latency"
            {...(summary.data ? { value: summary.data.avgDetectionLatencyMs } : {})}
            suffix=" ms"
            digits={1}
          />
          <MetricCard
            label="Avg Explanation Latency"
            {...(summary.data ? { value: summary.data.avgExplanationLatencyMs } : {})}
            suffix=" ms"
            digits={1}
          />
        </div>
      </Panel>
    </AppShell>
  );
}
