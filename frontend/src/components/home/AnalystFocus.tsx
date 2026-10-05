import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/common/Panel";
import { EmptyState, LoadingState } from "@/components/common/States";
import { useZoneExplanation } from "@/hooks/useNids";

export function AnalystFocus({ detectionId }: { detectionId?: string }) {
  const zone = useZoneExplanation(detectionId ?? "");
  const top = zone.data?.zones?.slice().sort((a, b) => a.rank - b.rank)[0];

  return (
    <Panel
      title="Analyst Focus"
      description="Summary of the current explanation data"
      className="h-full"
    >
      {!detectionId ? (
        <EmptyState message="Select a detection to view analyst focus." />
      ) : zone.isLoading ? (
        <LoadingState label="Loading explanation…" />
      ) : !top ? (
        <EmptyState message="No explanation data available." />
      ) : (
        <div className="space-y-3">
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Top contributing zone</dt>
              <dd className="font-medium text-foreground">{top.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Frequency range</dt>
              <dd className="tabular font-medium text-foreground">
                {top.frequencyStart}–{top.frequencyEnd} Hz
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Attribution</dt>
              <dd className="tabular font-medium text-foreground">
                {top.shapValue >= 0 ? "+" : ""}
                {top.shapValue.toFixed(3)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Rank</dt>
              <dd className="tabular font-medium text-foreground">#{top.rank}</dd>
            </div>
          </dl>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Inspect the associated detection and frequency spectrum to review this
            attribution. This is a summary of explanation data, not an automated
            recommendation.
          </p>
          <Link
            to="/detections/$id"
            params={{ id: detectionId }}
            className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Investigate Detection <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      )}
    </Panel>
  );
}
