import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Braces,
  Cpu,
  Network,
  Radar,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Node {
  label: string;
  detail: string;
  icon: LucideIcon;
  to?: "/monitoring" | "/detections" | "/explainability";
  tone: "info" | "normal" | "warning" | "attack" | "research";
}

const NODES: Node[] = [
  { label: "Network Traffic", detail: "Flow capture", icon: Network, tone: "info" },
  {
    label: "Time + FFT Features",
    detail: "Spectral transform",
    icon: Activity,
    to: "/monitoring",
    tone: "info",
  },
  { label: "XGBoost", detail: "Classifier", icon: Cpu, tone: "warning" },
  {
    label: "Attack Detection",
    detail: "Prediction + severity",
    icon: Radar,
    to: "/detections",
    tone: "attack",
  },
  {
    label: "Raw SHAP / Zone-SHAP",
    detail: "Attribution",
    icon: Braces,
    to: "/explainability",
    tone: "research",
  },
  {
    label: "Analyst Explanation",
    detail: "Interpretation",
    icon: Sparkles,
    to: "/explainability",
    tone: "research",
  },
];

const toneText: Record<Node["tone"], string> = {
  info: "text-info",
  normal: "text-normal",
  warning: "text-warning",
  attack: "text-attack",
  research: "text-research",
};

export function PipelineStrip() {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:items-stretch">
      {NODES.map((n, i) => {
        const body = (
          <div
            className={cn(
              "flex h-full min-w-0 items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 transition-colors",
              n.to && "hover:border-primary/50 hover:bg-accent",
            )}
          >
            <n.icon className={cn("size-4 shrink-0", toneText[n.tone])} aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{n.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{n.detail}</p>
            </div>
          </div>
        );
        return (
          <li key={n.label} className="flex min-w-0 items-center gap-2 xl:flex-1">
            <div className="min-w-0 flex-1">
              {n.to ? (
                <Link
                  to={n.to}
                  className="block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
            {i < NODES.length - 1 && (
              <ArrowRight
                className="hidden size-3.5 shrink-0 text-muted-foreground xl:block"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
