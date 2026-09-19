import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";

export default function ScenarioSimulatorPage() {
  return (
    <div>
      <PageHeader title="Scenario Simulator" description="Retrospective what-if analysis on your actual trade history." />
      <PhaseNotice feature="The Scenario Simulator" phase={5} />
      <EmptyState
        icon={FlaskConical}
        title="Scenario Simulator coming soon"
        description="Every result will be labeled: “Historical simulation only. This is not a prediction or guarantee of future performance.”"
      />
    </div>
  );
}
