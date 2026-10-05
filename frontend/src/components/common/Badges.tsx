import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Prediction, Severity } from "@/types";

const severityStyles: Record<Severity, string> = {
  low: "border-info/40 bg-info/10 text-info",
  medium: "border-warning/40 bg-warning/10 text-warning",
  high: "border-attack/40 bg-attack/10 text-attack",
  critical: "border-attack/60 bg-attack/20 text-attack",
};

const severityIcon: Record<Severity, typeof AlertTriangle> = {
  low: CheckCircle2,
  medium: AlertTriangle,
  high: ShieldAlert,
  critical: ShieldX,
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = severityIcon[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase",
        severityStyles[severity],
      )}
    >
      <Icon className="size-3" aria-hidden />
      {severity}
    </span>
  );
}

export function PredictionBadge({ prediction }: { prediction: Prediction }) {
  const attack = prediction === "attack";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase",
        attack
          ? "border-attack/50 bg-attack/10 text-attack"
          : "border-normal/40 bg-normal/10 text-normal",
      )}
    >
      {attack ? <ShieldAlert className="size-3" /> : <CheckCircle2 className="size-3" />}
      {prediction}
    </span>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "normal" | "warning" | "attack" | "muted" | "info" | "research";
}) {
  const tones: Record<string, string> = {
    normal: "border-normal/40 bg-normal/10 text-normal",
    warning: "border-warning/40 bg-warning/10 text-warning",
    attack: "border-attack/50 bg-attack/10 text-attack",
    info: "border-info/40 bg-info/10 text-info",
    research: "border-research/40 bg-research/10 text-research",
    muted: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}
