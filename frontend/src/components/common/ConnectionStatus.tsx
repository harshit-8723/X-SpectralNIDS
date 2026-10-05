import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/types";

interface ConnectionStatusProps {
  label: string;
  state: ConnectionState | "unknown";
  className?: string;
}

const stateText: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
  unknown: "Unknown",
};

const stateTone: Record<string, string> = {
  connected: "bg-normal",
  connecting: "bg-warning",
  reconnecting: "bg-warning",
  disconnected: "bg-attack",
  unknown: "bg-muted-foreground",
};

export function ConnectionStatus({ label, state, className }: ConnectionStatusProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn(
          "size-2 rounded-full",
          stateTone[state],
          (state === "connecting" || state === "reconnecting") && "animate-pulse",
        )}
        aria-hidden
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground">{stateText[state]}</span>
    </span>
  );
}
