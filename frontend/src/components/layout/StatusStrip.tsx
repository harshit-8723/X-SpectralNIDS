import { USE_REAL_API } from "@/constants";
import { useSystemStatus } from "@/hooks/useNids";
import { cn } from "@/lib/utils";

type Tone = "normal" | "warning" | "muted";

const dot: Record<Tone, string> = {
  normal: "bg-normal",
  warning: "bg-warning",
  muted: "bg-muted-foreground",
};

function Item({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-1.5">
      <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", dot[tone])} aria-hidden />
        <span className="truncate text-[11px] font-medium text-foreground">{value}</span>
      </span>
    </div>
  );
}

/** Compact SOC status bar. Reflects only real state from useSystemStatus. */
export function StatusStrip() {
  const { data: status, isLoading } = useSystemStatus();
  const demo = !USE_REAL_API || !status?.backendConnected;

  const items: { label: string; value: string; tone: Tone }[] = [
    {
      label: "System",
      value: isLoading ? "Checking…" : "Operational (UI)",
      tone: isLoading ? "muted" : "normal",
    },
    {
      label: "Backend",
      value: status?.backendConnected ? "Connected" : "Not connected — demo mode",
      tone: status?.backendConnected ? "normal" : "warning",
    },
    {
      label: "Model",
      value: status?.modelVersion ?? "Unknown",
      tone: status?.backendConnected ? "normal" : "muted",
    },
    {
      label: "Stream",
      value: status?.streaming ? "Streaming" : demo ? "Demo stream" : "Idle",
      tone: status?.streaming ? "normal" : "warning",
    },
    {
      label: "FFT",
      value: status?.backendConnected ? "Available" : "Demo spectrum",
      tone: status?.backendConnected ? "normal" : "warning",
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center divide-border rounded-md border border-border bg-surface sm:divide-x"
      role="status"
      aria-label="System status"
    >
      {items.map((i) => (
        <Item key={i.label} {...i} />
      ))}
    </div>
  );
}
