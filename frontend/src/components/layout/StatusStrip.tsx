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
  const live = Boolean(status?.backendConnected);

  const items: { label: string; value: string; tone: Tone }[] = [
    {
      label: "System",
      value: isLoading ? "Checking…" : live ? "Operational" : "UI only",
      tone: isLoading ? "muted" : live ? "normal" : "warning",
    },
    {
      label: "Backend",
      value: live ? "Connected" : "Not connected",
      tone: live ? "normal" : "warning",
    },
    {
      label: "Model",
      value: status?.modelVersion ?? "Unknown",
      tone: live ? "normal" : "muted",
    },
    {
      label: "Stream",
      value: status?.streaming ? "Streaming" : live ? "Idle" : "Offline",
      tone: status?.streaming ? "normal" : "warning",
    },
    {
      label: "FFT",
      value: live ? "Model B bins" : "Unavailable",
      tone: live ? "normal" : "warning",
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
