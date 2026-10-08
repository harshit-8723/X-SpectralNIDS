import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Detection } from "@/types";
import { PredictionBadge, SeverityBadge } from "@/components/common/Badges";
import { formatPercent, formatTime } from "@/utils/format";

export function DetectionsTable({
  detections,
  showProtocol = false,
}: {
  detections: Detection[];
  showProtocol?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium">Time</th>
            <th className="py-2 pr-3 font-medium">Source</th>
            <th className="py-2 pr-3 font-medium">Destination</th>
            {showProtocol && <th className="py-2 pr-3 font-medium">Protocol</th>}
            <th className="py-2 pr-3 font-medium">Attack Type</th>
            <th className="py-2 pr-3 font-medium">Prediction</th>
            <th className="py-2 pr-3 font-medium">Confidence</th>
            <th className="py-2 pr-3 font-medium">Severity</th>
            <th className="py-2 pr-3 font-medium">Explanation</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {detections.map((d) => (
            <tr key={d.id} className="border-b border-border/60 hover:bg-accent/40">
              <td className="tabular py-2 pr-3 text-muted-foreground">
                {formatTime(d.timestamp)}
              </td>
              <td className="tabular py-2 pr-3 font-mono">{d.source}</td>
              <td className="tabular py-2 pr-3 font-mono">{d.destination}</td>
              {showProtocol && <td className="py-2 pr-3">{d.protocol ?? "—"}</td>}
              <td className="py-2 pr-3">{d.attackType}</td>
              <td className="py-2 pr-3">
                <PredictionBadge prediction={d.prediction} />
              </td>
              <td className="tabular py-2 pr-3">{formatPercent(d.confidence)}</td>
              <td className="py-2 pr-3">
                <SeverityBadge severity={d.severity} />
              </td>
              <td className="py-2 pr-3 text-muted-foreground">
                {d.explanationAvailable ? "Available" : "—"}
              </td>
              <td className="py-2">
                <Link
                  to="/detections/$id"
                  params={{ id: d.id }}
                  className="inline-flex items-center gap-1 text-info hover:underline"
                >
                  Investigate <ChevronRight className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
