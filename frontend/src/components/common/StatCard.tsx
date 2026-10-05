import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "normal" | "warning" | "attack" | "info" | "research";
  loading?: boolean;
  /** Documented future backend source, shown as a tooltip for maintainers. */
  source?: string;
}

const toneMap: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  normal: "text-normal",
  warning: "text-warning",
  attack: "text-attack",
  info: "text-info",
  research: "text-research",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
  source,
}: StatCardProps) {
  return (
    <div className="panel p-4" title={source}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {Icon && <Icon className={cn("size-4", toneMap[tone])} aria-hidden />}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <p className={cn("tabular mt-2 text-2xl font-semibold", toneMap[tone])}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
