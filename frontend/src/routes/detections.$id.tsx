import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { MetricCard } from "@/components/common/MetricCard";
import { PredictionBadge, SeverityBadge } from "@/components/common/Badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { SpectrumChart } from "@/components/charts/SpectrumChart";
import { ShapBarChart } from "@/components/charts/ShapBarChart";
import { ZoneBars } from "@/components/explainability/ZoneBars";
import { ZoneSummary } from "@/components/explainability/ZoneSummary";
import { useDetection, useRawExplanation, useZoneExplanation } from "@/hooks/useNids";
import { formatBytes, formatDateTime, formatMs, formatNumber, formatPercent } from "@/utils/format";

export const Route = createFileRoute("/detections/$id")({
  head: () => ({
    meta: [
      { title: "Detection Investigation — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Full investigation view: network context, time-domain statistics, FFT spectrum, raw SHAP and zone-grouped SHAP explanations.",
      },
      { property: "og:title", content: "Detection Investigation — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Frequency-domain and explainable-AI breakdown for a single detection.",
      },
    ],
  }),
  component: DetectionDetailPage,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="tabular mt-1 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function DetectionDetailPage() {
  const { id } = Route.useParams();
  const detection = useDetection(id);
  const raw = useRawExplanation(id);
  const zone = useZoneExplanation(id);

  const d = detection.data;

  return (
    <AppShell
      title="Detection Investigation"
      subtitle={`Detection ${id}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/detections"
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <ArrowLeft className="size-3" /> Back to detections
          </Link>
          <Link
            to="/explainability"
            search={{ detection: id }}
            className="inline-flex items-center gap-1 rounded-md border border-research/40 bg-research/10 px-3 py-1.5 text-xs text-research hover:bg-research/20"
          >
            <Sparkles className="size-3" /> Open in Explainability
          </Link>
        </div>
      }
    >
      {detection.isLoading ? (
        <LoadingState label="Loading detection…" />
      ) : detection.isError ? (
        <ErrorState
          message={(detection.error as Error).message}
          onRetry={detection.refetch}
        />
      ) : !d ? (
        <EmptyState message="Detection not found." />
      ) : (
        <>
          <Panel title="Detection Summary">
            <div className="flex flex-wrap items-center gap-3">
              <PredictionBadge prediction={d.prediction} />
              <SeverityBadge severity={d.severity} />
              <span className="text-sm text-foreground">{d.attackType}</span>
              <span className="tabular text-sm text-muted-foreground">
                Confidence {formatPercent(d.confidence)}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(d.timestamp)}</span>
              <span className="font-mono text-xs text-muted-foreground">{d.id}</span>
            </div>
          </Panel>

          <Panel title="Network Information">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Source" value={d.source} />
              <Field label="Destination" value={d.destination} />
              {d.protocol && <Field label="Protocol" value={d.protocol} />}
              {d.port !== undefined && <Field label="Port" value={String(d.port)} />}
              <Field label="Packets" value={formatNumber(d.traffic.packets)} />
              <Field label="Bytes" value={formatBytes(d.traffic.bytes)} />
              <Field label="Duration" value={formatMs(d.traffic.durationMs)} />
              <Field
                label="Packet rate"
                value={`${formatNumber(d.traffic.packetRate, 1)} pkt/s`}
              />
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Time-Domain Analysis"
              description="Inter-arrival statistics for the classified window"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Mean IAT"
                  value={d.traffic.interArrivalMeanMs}
                  suffix=" ms"
                  digits={2}
                />
                <MetricCard
                  label="Std IAT"
                  value={d.traffic.interArrivalStdMs}
                  suffix=" ms"
                  digits={2}
                />
                <MetricCard
                  label="Min IAT"
                  value={d.traffic.interArrivalMinMs}
                  suffix=" ms"
                  digits={2}
                />
                <MetricCard
                  label="Max IAT"
                  value={d.traffic.interArrivalMaxMs}
                  suffix=" ms"
                  digits={2}
                />
              </div>
            </Panel>

            <Panel
              title="Frequency-Domain Analysis"
              description={`FFT magnitude spectrum · dominant ≈ ${d.dominantFrequency.toFixed(2)} Hz`}
            >
              {d.spectrum.length === 0 ? (
                <EmptyState message="No spectrum available for this detection." />
              ) : (
                <SpectrumChart data={d.spectrum} dominantFrequency={d.dominantFrequency} />
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Raw SHAP"
              description="Per-feature and per-frequency-bin contributions"
            >
              {raw.isLoading ? (
                <LoadingState label="Computing raw SHAP…" />
              ) : raw.isError ? (
                <ErrorState message={(raw.error as Error).message} onRetry={raw.refetch} />
              ) : !raw.data ? (
                <EmptyState message="No raw explanation available." />
              ) : (
                <ShapBarChart
                  data={raw.data.features.slice(0, 12).map((f) => ({
                    label: f.feature,
                    value: f.shapValue,
                  }))}
                />
              )}
            </Panel>

            <Panel
              title="Zone-Grouped SHAP"
              description="Frequency bins aggregated into interpretable spectral zones"
            >
              {zone.isLoading ? (
                <LoadingState label="Computing zone attribution…" />
              ) : zone.isError ? (
                <ErrorState message={(zone.error as Error).message} onRetry={zone.refetch} />
              ) : !zone.data ? (
                <EmptyState message="No zone explanation available." />
              ) : (
                <ZoneBars zones={zone.data.zones} />
              )}
            </Panel>
          </div>

          <Panel
            title="Explanation Comparison"
            description="Raw SHAP vs Zone-SHAP for this detection — reported as measured, without ranking either method"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Faithfulness (raw)"
                {...(raw.data?.metrics.faithfulness !== undefined
                  ? { value: raw.data.metrics.faithfulness }
                  : {})}
              />
              <MetricCard
                label="Faithfulness (zone)"
                {...(zone.data?.metrics.faithfulness !== undefined
                  ? { value: zone.data.metrics.faithfulness }
                  : {})}
              />
              <MetricCard
                label="Stability (raw)"
                {...(raw.data?.metrics.stability !== undefined
                  ? { value: raw.data.metrics.stability }
                  : {})}
              />
              <MetricCard
                label="Stability (zone)"
                {...(zone.data?.metrics.stability !== undefined
                  ? { value: zone.data.metrics.stability }
                  : {})}
              />
              <MetricCard
                label="Compactness (raw)"
                digits={0}
                {...(raw.data?.metrics.compactness !== undefined
                  ? { value: raw.data.metrics.compactness }
                  : {})}
                description="features above the significance threshold"
              />
              <MetricCard
                label="Compactness (zone)"
                digits={0}
                {...(zone.data?.metrics.compactness !== undefined
                  ? { value: zone.data.metrics.compactness }
                  : {})}
                description="zones above the significance threshold"
              />
              <MetricCard
                label="Latency (raw)"
                suffix=" ms"
                digits={1}
                {...(raw.data?.metrics.latencyMs !== undefined
                  ? { value: raw.data.metrics.latencyMs }
                  : {})}
              />
              <MetricCard
                label="Latency (zone)"
                suffix=" ms"
                digits={1}
                {...(zone.data?.metrics.latencyMs !== undefined
                  ? { value: zone.data.metrics.latencyMs }
                  : {})}
              />
            </div>
            <div className="mt-3">
              <ZoneSummary detectionId={id} />
            </div>
          </Panel>
        </>
      )}
    </AppShell>
  );
}
