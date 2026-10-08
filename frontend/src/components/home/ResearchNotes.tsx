import { Panel } from "@/components/common/Panel";

export function ResearchNotes() {
  return (
    <Panel
      title="Research Context"
      description="Why frequency-domain analysis and why grouped zones"
      className="h-full"
    >
      <div className="space-y-4">
        <section>
          <h3 className="text-xs font-semibold text-foreground">
            Why Frequency-Domain Analysis?
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Traditional traffic statistics can miss quiet periodic behavior. FFT analysis
            exposes recurring traffic patterns that may provide additional signals for
            intrusion detection.
          </p>
        </section>
        <section>
          <h3 className="text-xs font-semibold text-foreground">Why Zone-SHAP?</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Instead of presenting many individual frequency-bin contributions, related
            frequency components are grouped into analyst-oriented zones.
          </p>
        </section>
        <p className="rounded-md border border-research/30 bg-research/5 p-2.5 text-[11px] text-muted-foreground">
          Both questions are still under evaluation in this project; no superiority claim
          is made by this interface.
        </p>
      </div>
    </Panel>
  );
}
