import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { useZoneExplanation } from "@/hooks/useNids";
import { ZoneBars } from "./ZoneBars";

export function ZoneSummary({ detectionId }: { detectionId?: string | undefined }) {
  const zone = useZoneExplanation(detectionId ?? "");

  if (!detectionId) return <EmptyState message="No detection selected." />;
  if (zone.isLoading) return <LoadingState label="Computing zone attribution…" />;
  if (zone.isError)
    return <ErrorState message={(zone.error as Error).message} onRetry={zone.refetch} />;
  if (!zone.data) return <EmptyState message="No explanation available." />;

  return (
    <div className="space-y-3">
      <ZoneBars zones={zone.data.zones} />
      {zone.data.analystSummary && (
        <p className="rounded-md border border-research/30 bg-research/5 p-3 text-xs text-muted-foreground">
          {zone.data.analystSummary}
        </p>
      )}
    </div>
  );
}
