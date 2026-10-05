import { formatMetric } from "@/utils/format";

interface MetricCardProps {
  label: string;
  value?: number;
  suffix?: string;
  digits?: number;
  description?: string;
}

export function MetricCard({ label, value, suffix, digits = 3, description }: MetricCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold text-foreground">
        {value === undefined ? "—" : `${formatMetric(value, digits)}${suffix ?? ""}`}
      </p>
      {description && <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>}
    </div>
  );
}
