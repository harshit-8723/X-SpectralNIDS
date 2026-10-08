import type { ShapZone } from "@/types";
import { cn } from "@/lib/utils";

/** Compact ranked zone bars — readable in narrow panels. */
export function ZoneBars({ zones }: { zones: ShapZone[] }) {
  const max = Math.max(...zones.map((z) => Math.abs(z.shapValue)), 0.0001);
  return (
    <ul className="space-y-2.5">
      {zones.map((z) => {
        const pct = (Math.abs(z.shapValue) / max) * 100;
        const positive = z.shapValue >= 0;
        return (
          <li key={z.id}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">
                #{z.rank} {z.name}
              </span>
              <span className="tabular text-muted-foreground">
                {z.frequencyStart}–{z.frequencyEnd} Hz
              </span>
              <span
                className={cn(
                  "tabular font-medium",
                  positive ? "text-attack" : "text-normal",
                )}
              >
                {z.shapValue >= 0 ? "+" : ""}
                {z.shapValue.toFixed(3)}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className={cn("h-full rounded", positive ? "bg-attack" : "bg-normal")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {z.interpretation && (
              <p className="mt-1 text-[11px] text-muted-foreground">{z.interpretation}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
