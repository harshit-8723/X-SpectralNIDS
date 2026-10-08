import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-sm">
      <AlertCircle className="size-5 text-attack" aria-hidden />
      <p className="text-foreground">Could not load data</p>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Inbox className="size-5" aria-hidden />
      {message}
    </div>
  );
}

export function AwaitingBackend({ what = "backend experiment results" }: { what?: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
      Awaiting {what}
    </div>
  );
}
