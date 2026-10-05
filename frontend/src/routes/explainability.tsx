import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { MetricCard } from "@/components/common/MetricCard";
import { PredictionBadge, SeverityBadge } from "@/components/common/Badges";
import {
  AwaitingBackend,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/common/States";
import { ShapBarChart } from "@/components/charts/ShapBarChart";
import { ZoneBars } from "@/components/explainability/ZoneBars";
import { ZoneSummary } from "@/components/explainability/ZoneSummary";
import {
  useDetections,
  useRawExplanation,
  useZoneExplanation,
} from "@/hooks/useNids";
import { formatMetric, formatMs } from "@/utils/format";
import { cn } from "@/lib/utils";

interface ExplainabilitySearch {
  detection?: string | undefined;
}

export const Route = createFileRoute("/explainability")({
  validateSearch: (search: Record<string, unknown>): ExplainabilitySearch => {
    const raw = search["detection"];
    return typeof raw === "string" && raw.length > 0 ? { detection: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "Zone-SHAP Explainability — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Compare raw SHAP feature attributions with zone-grouped SHAP for frequency-domain network intrusion detections.",
      },
      { property: "og:title", content: "Zone-SHAP Explainability — X-SpectralNIDS" },
      {
        property: "og:description",
        content:
          "Side-by-side raw SHAP and zone-grouped SHAP explanation analysis with research metrics.",
      },
    ],
  }),
  component: ExplainabilityPage,
});

function MetricGrid({
  faithfulness,
  stability,
  compactness,
  latencyMs,
}: {
  faithfulness?: number | undefined;
  stability?: number | undefined;
  compactness?: number | undefined;
  latencyMs?: number | undefined;
}) {
  const cells: Array<[string, string]> = [
    ["Faithfulness", formatMetric(faithfulness)],
    ["Stability", formatMetric(stability)],
    ["Compactness", formatMetric(compactness, 0)],
    ["Explanation Latency", formatMs(latencyMs)],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="tabular mt-1 text-xl font-semibold text-foreground">
            {value === "—" ? (
              <span className="text-xs font-normal text-muted-foreground">
                Awaiting experiment results
              </span>
            ) : (
              value
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function ExplainabilityPage() {
  const { detection: selectedId } = Route.useSearch();
  const navigate = Route.useNavigate();

  const detections = useDetections({ page: 1, pageSize: 25 });
  const items = detections.data?.items ?? [];
  const activeId = selectedId ?? items[0]?.id ?? "";
  const active = items.find((d) => d.id === activeId);

  const raw = useRawExplanation(activeId);
  const zone = useZoneExplanation(activeId);

  const rawBars =
    raw.data?.features
      .slice()
      .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
      .slice(0, 12)
      .map((f) => ({ label: f.feature, value: f.shapValue })) ?? [];

  const zoneBars =
    zone.data?.zones.map((z) => ({ label: z.name, value: z.shapValue })) ?? [];

  return (
    <AppShell
      title="Zone-SHAP Explainability"
      subtitle="Frequency-domain explanation analysis for network intrusion detection"
    >
      <Panel
        title="Detection Selector"
        description="Choose a detection to explain. The selection is reflected in the URL (?detection=…)."
      >
        {detections.isLoading ? (
          <LoadingState label="Loading detections…" />
        ) : detections.isError ? (
          <ErrorState
            message={(detections.error as Error).message}
            onRetry={detections.refetch}
          />
        ) : !items.length ? (
          <EmptyState message="No detections available." />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="detection-select"
                className="text-xs tracking-wide text-muted-foreground uppercase"
              >
                Detection
              </label>
              <select
                id="detection-select"
                value={activeId}
                onChange={(e) =>
                  navigate({ to: ".", search: { detection: e.target.value } })
                }
                className="min-w-[280px] rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-xs text-foreground"
              >
                {items.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} · {d.attackType} · {d.source} → {d.destination}
                  </option>
                ))}
              </select>
            </div>
            {active && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <SeverityBadge severity={active.severity} />
                <PredictionBadge prediction={active.prediction} />
                <span className="tabular">
                  confidence {(active.confidence * 100).toFixed(1)}%
                </span>
                <span>{active.attackType}</span>
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Raw SHAP"
          description="Per-feature attribution over individual frequency bins and time-domain features"
        >
          {!activeId ? (
            <EmptyState message="No detection selected." />
          ) : raw.isLoading ? (
            <LoadingState label="Computing raw attribution…" />
          ) : raw.isError ? (
            <ErrorState message={(raw.error as Error).message} onRetry={raw.refetch} />
          ) : !rawBars.length ? (
            <AwaitingBackend what="raw SHAP attributions" />
          ) : (
            <div className="space-y-3">
              <ShapBarChart data={rawBars} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">Rank</th>
                      <th className="py-2 pr-3 font-medium">Feature</th>
                      <th className="py-2 pr-3 font-medium">Bin</th>
                      <th className="py-2 pr-3 font-medium">SHAP</th>
                      <th className="py-2 font-medium">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawBars.map((b, i) => {
                      const feature = raw.data?.features.find((f) => f.feature === b.label);
                      const positive = b.value >= 0;
                      return (
                        <tr key={b.label} className="border-b border-border/60">
                          <td className="tabular py-2 pr-3">{i + 1}</td>
                          <td className="py-2 pr-3 font-mono">{b.label}</td>
                          <td className="tabular py-2 pr-3">{feature?.bin ?? "—"}</td>
                          <td
                            className={cn(
                              "tabular py-2 pr-3",
                              positive ? "text-attack" : "text-normal",
                            )}
                          >
                            {positive ? "+" : ""}
                            {b.value.toFixed(4)}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {positive ? "toward attack" : "toward normal"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Zone-Grouped SHAP"
          description="Attribution aggregated into contiguous frequency zones"
        >
          {!activeId ? (
            <EmptyState message="No detection selected." />
          ) : zone.isLoading ? (
            <LoadingState label="Computing zone attribution…" />
          ) : zone.isError ? (
            <ErrorState message={(zone.error as Error).message} onRetry={zone.refetch} />
          ) : !zoneBars.length ? (
            <AwaitingBackend what="zone-grouped SHAP attributions" />
          ) : (
            <div className="space-y-3">
              <ShapBarChart data={zoneBars} />
              <ZoneBars zones={zone.data?.zones ?? []} />
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Side-by-Side Comparison"
        description="Both methods explain the same detection at different granularities; values are reported as measured"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
              Raw SHAP
            </p>
            <p className="text-xs text-muted-foreground">
              {rawBars.length ? `${raw.data?.features.length ?? 0} attributed features` : "—"}
            </p>
            <MetricGrid
              faithfulness={raw.data?.metrics.faithfulness}
              stability={raw.data?.metrics.stability}
              compactness={raw.data?.metrics.compactness}
              latencyMs={raw.data?.metrics.latencyMs}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
              Zone-Grouped SHAP
            </p>
            <p className="text-xs text-muted-foreground">
              {zoneBars.length ? `${zone.data?.zones.length ?? 0} frequency zones` : "—"}
            </p>
            <MetricGrid
              faithfulness={zone.data?.metrics.faithfulness}
              stability={zone.data?.metrics.stability}
              compactness={zone.data?.metrics.compactness}
              latencyMs={zone.data?.metrics.latencyMs}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Analyst Summary" description="Narrative generated from the zone attribution">
        <ZoneSummary detectionId={activeId || undefined} />
      </Panel>

      <Panel title="Latency" description="Explanation computation time reported per method">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Raw SHAP Latency"
            {...(raw.data?.metrics.latencyMs !== undefined
              ? { value: raw.data.metrics.latencyMs }
              : {})}
            suffix=" ms"
            digits={1}
          />
          <MetricCard
            label="Zone-SHAP Latency"
            {...(zone.data?.metrics.latencyMs !== undefined
              ? { value: zone.data.metrics.latencyMs }
              : {})}
            suffix=" ms"
            digits={1}
          />
        </div>
      </Panel>
    </AppShell>
  );
}
