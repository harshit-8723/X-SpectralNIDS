import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/common/Panel";
import { APP_FULL_TITLE } from "@/constants";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — X-SpectralNIDS" },
      {
        name: "description",
        content:
          "X-SpectralNIDS combines time-domain and FFT frequency-domain traffic features with XGBoost and SHAP-based explanations for network intrusion detection.",
      },
      { property: "og:title", content: "About — X-SpectralNIDS" },
      {
        property: "og:description",
        content:
          "Research context, architecture and open research question behind zone-grouped explainable frequency-domain intrusion detection.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <AppShell title="About" subtitle={APP_FULL_TITLE}>
      <Panel title="What X-SpectralNIDS Is">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          X-SpectralNIDS is a network intrusion detection system that combines traditional
          time-domain traffic information (packet counts, flow duration, inter-arrival statistics)
          with frequency-domain information obtained by applying an FFT to the packet arrival
          process. Classification is performed by a gradient-boosted tree model, and every decision
          is accompanied by an explanation produced with SHAP.
        </p>
      </Panel>

      <Panel title="Architecture">
        <pre className="overflow-x-auto rounded-md border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-foreground">
{`Network Traffic
   -> Time-domain features  (packets, duration, IAT mean/std/min/max, bytes, rate)
   -> Frequency-domain features (FFT magnitude bins, dominant frequency)
   -> XGBoost classifier
   -> Attack / Normal + confidence
   -> Explanation layer
        - Raw SHAP     (per feature / per frequency bin)
        - Zone-SHAP    (frequency bins grouped into spectral zones)`}
        </pre>
      </Panel>

      <Panel title="Research Question">
        <p className="max-w-3xl rounded-md border border-research/30 bg-research/5 p-4 text-sm leading-relaxed text-foreground">
          “Does grouping frequency-domain features into meaningful zones make SHAP explanations more
          useful and stable than conventional per-frequency-bin explanations?”
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          This question is open. Zone-grouping is a candidate explanation strategy, not a proven
          improvement: the experimental outcome may turn out positive, negative or mixed depending
          on the dataset, attack family and the metric considered (faithfulness, stability,
          compactness, latency). The interface therefore presents Raw SHAP and Zone-SHAP side by
          side without asserting that either is superior.
        </p>
      </Panel>

      <Panel title="Current Status">
        <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
          <li>The frontend is complete and reads exclusively through the service layer.</li>
          <li>
            Until the Python/FastAPI backend is connected, the service layer resolves against a
            deterministic mock dataset; enabling the real API requires no page changes.
          </li>
          <li>Live monitoring consumes a WebSocket stream when the backend is available.</li>
          <li>Reported metric values are placeholders until real experiments are run.</li>
        </ul>
      </Panel>
    </AppShell>
  );
}
