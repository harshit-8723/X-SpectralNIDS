import { Panel } from "@/components/common/Panel";
import { FREQUENCY_BINS, DATASET_NAME } from "@/constants";
import { useSystemStatus } from "@/hooks/useNids";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-xs font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

export function ModelCard() {
  const { data: status } = useSystemStatus();

  return (
    <Panel
      title="Model & Analysis"
      description="Configured analysis pipeline"
      className="h-full"
    >
      <div>
        <Row label="Model" value="XGBoost Classifier" />
        <Row label="Features" value="Time + Frequency (FFT)" />
        <Row label="Explanation" value="Raw SHAP + Zone-SHAP" />
        <Row label="Frequency bins" value={`${FREQUENCY_BINS}`} />
        <Row label="Dataset" value={DATASET_NAME ?? "Awaiting backend configuration"} />
        <Row
          label="Model version"
          value={status?.modelVersion ?? "Awaiting backend configuration"}
        />
      </div>
    </Panel>
  );
}
