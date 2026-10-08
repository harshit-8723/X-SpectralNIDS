import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { SeverityBadge, StatusBadge } from "@/components/common/Badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { useAlerts, useUpdateAlertStatus } from "@/hooks/useNids";
import { formatDateTime, formatPercent } from "@/utils/format";
import type { AlertStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUSES: Array<{ value: AlertStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "confirmed", label: "Confirmed" },
  { value: "resolved", label: "Resolved" },
  { value: "false_positive", label: "False Positive" },
];

const statusTone: Record<AlertStatus, "attack" | "warning" | "normal" | "muted" | "info"> = {
  new: "attack",
  investigating: "warning",
  confirmed: "attack",
  resolved: "normal",
  false_positive: "muted",
};

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "Triage intrusion alerts by severity, attack type and confidence, and track investigation status across the SOC workflow.",
      },
      { property: "og:title", content: "Alerts — X-SpectralNIDS" },
      {
        property: "og:description",
        content: "Alert triage and investigation tracking for frequency-domain intrusion detection.",
      },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const alerts = useAlerts();
  const update = useUpdateAlertStatus();
  const [filter, setFilter] = useState<AlertStatus | "all">("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const items = alerts.data ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((a) => a.status === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const by = (s: AlertStatus) => items.filter((a) => a.status === s).length;
    return {
      total: items.length,
      new: by("new"),
      investigating: by("investigating"),
      critical: items.filter((a) => a.severity === "critical" || a.severity === "high").length,
    };
  }, [items]);

  function changeStatus(id: string, status: AlertStatus) {
    update.mutate(
      { id, status },
      {
        onSuccess: () => setFeedback(`Alert ${id} marked as ${status.replace("_", " ")}.`),
        onError: (e) => setFeedback(`Could not update ${id}: ${(e as Error).message}`),
      },
    );
  }

  return (
    <AppShell
      title="Alerts"
      subtitle="Triage and track investigation status for detections escalated to alerts"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Alerts" value={String(counts.total)} loading={alerts.isLoading} />
        <StatCard label="New" value={String(counts.new)} tone="attack" loading={alerts.isLoading} />
        <StatCard
          label="Investigating"
          value={String(counts.investigating)}
          tone="warning"
          loading={alerts.isLoading}
        />
        <StatCard
          label="High / Critical"
          value={String(counts.critical)}
          tone="attack"
          loading={alerts.isLoading}
        />
      </div>

      {feedback && (
        <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
          {feedback}
        </div>
      )}

      <Panel
        title="Alert Queue"
        description="Status changes are persisted through the alert service"
        actions={
          <div className="flex flex-wrap gap-1">
            {(["all", ...STATUSES.map((s) => s.value)] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "rounded border px-2 py-1 text-[11px] capitalize",
                  filter === s
                    ? "border-info/50 bg-info/10 text-info"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        }
      >
        {alerts.isLoading ? (
          <LoadingState label="Loading alerts…" />
        ) : alerts.isError ? (
          <ErrorState message={(alerts.error as Error).message} onRetry={alerts.refetch} />
        ) : !filtered.length ? (
          <EmptyState message="No alerts match the current filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Severity</th>
                  <th className="py-2 pr-3 font-medium">Attack Type</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Destination</th>
                  <th className="py-2 pr-3 font-medium">Confidence</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 align-middle">
                    <td className="tabular py-2 pr-3 whitespace-nowrap">
                      {formatDateTime(a.timestamp)}
                    </td>
                    <td className="py-2 pr-3">
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td className="py-2 pr-3">{a.attackType}</td>
                    <td className="py-2 pr-3 font-mono">{a.source}</td>
                    <td className="py-2 pr-3 font-mono">{a.destination}</td>
                    <td className="tabular py-2 pr-3">{formatPercent(a.confidence)}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge
                        label={a.status.replace("_", " ")}
                        tone={statusTone[a.status]}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Status for alert ${a.id}`}
                          value={a.status}
                          disabled={update.isPending}
                          onChange={(e) =>
                            changeStatus(a.id, e.target.value as AlertStatus)
                          }
                          className="rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-foreground disabled:opacity-50"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <Link
                          to="/detections/$id"
                          params={{ id: a.detectionId }}
                          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
                        >
                          Investigate
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
