import { Layers } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function StrategyAnalysisPage() {
  return (
    <PlaceholderPage
      title="Strategy Analysis"
      description="Performance broken down by strategy, including the Strategy Truth Report."
      feature="Strategy Analysis"
      phase={4}
      icon={Layers}
      emptyTitle="Strategy analysis coming soon"
      emptyDescription="Tag trades by strategy to unlock this breakdown once the Analytics module ships."
    />
  );
}
