import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/common/States";
import { DetectionsTable } from "@/components/detections/DetectionsTable";
import { useDetections } from "@/hooks/useNids";
import { listAttackTypes } from "@/services/api/detectionApi";
import { SEVERITY_ORDER } from "@/constants";
import type { DetectionFilters, Prediction, Severity } from "@/types";
import { formatNumber, formatPercent } from "@/utils/format";

export const Route = createFileRoute("/detections/")({
  head: () => ({
    meta: [
      { title: "Detections — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Search, filter and investigate frequency-domain intrusion detections produced by X-SpectralNIDS.",
      },
      { property: "og:title", content: "Detections — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Detection management console with severity, attack-type and confidence filters.",
      },
    ],
  }),
  component: DetectionsPage,
});

const PAGE_SIZE = 15;

const selectClass =
  "h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-info";

function DetectionsPage() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [attackType, setAttackType] = useState<string>("all");
  const [prediction, setPrediction] = useState<Prediction | "all">("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [page, setPage] = useState(1);

  const attackTypes = useMemo(() => listAttackTypes(), []);

  const filters: DetectionFilters = {
    search,
    severity,
    attackType,
    prediction,
    minConfidence,
    page,
    pageSize: PAGE_SIZE,
  };
  const query = useDetections(filters);
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function update<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <AppShell
      title="Detections"
      subtitle="Every classified traffic window, with model prediction, confidence and explanation availability"
    >
      <Panel
        title="Filters"
        description={
          data ? `${formatNumber(data.total)} detections match the current filters` : "Loading…"
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Search
            <input
              value={search}
              onChange={(e) => update(setSearch)(e.target.value)}
              placeholder="ID, source, destination, attack type"
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-info"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Attack type
            <select
              value={attackType}
              onChange={(e) => update(setAttackType)(e.target.value)}
              className={selectClass}
            >
              <option value="all">All types</option>
              {attackTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Severity
            <select
              value={severity}
              onChange={(e) => update(setSeverity)(e.target.value as Severity | "all")}
              className={selectClass}
            >
              <option value="all">All severities</option>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Prediction
            <select
              value={prediction}
              onChange={(e) => update(setPrediction)(e.target.value as Prediction | "all")}
              className={selectClass}
            >
              <option value="all">All predictions</option>
              <option value="attack">attack</option>
              <option value="normal">normal</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Min confidence — {formatPercent(minConfidence, 0)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(e) => update(setMinConfidence)(Number(e.target.value))}
              className="mt-2 accent-[var(--info)]"
            />
          </label>
        </div>
      </Panel>

      <Panel
        title="Detection Records"
        description="Click Investigate to open the full frequency-domain and SHAP analysis"
        actions={
          data ? (
            <span className="text-xs text-muted-foreground">
              Page {data.page} of {totalPages}
            </span>
          ) : null
        }
      >
        {query.isLoading && !data ? (
          <SkeletonRows rows={8} />
        ) : query.isError ? (
          <ErrorState message={(query.error as Error).message} onRetry={query.refetch} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState message="No detections match the current filters." />
        ) : (
          <>
            <DetectionsTable detections={data.items} showProtocol />
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Showing {data.items.length} of {formatNumber(data.total)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
