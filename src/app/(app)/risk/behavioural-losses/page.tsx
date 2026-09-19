import { Brain } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function BehaviouralLossesPage() {
  return (
    <PlaceholderPage
      title="Behavioural Losses"
      description="The rupee cost of revenge trading, overtrading, FOMO and other detected behavioural patterns."
      feature="The Behavioural Loss Engine"
      phase={4}
      icon={Brain}
      emptyTitle="Behavioural pattern detection coming soon"
      emptyDescription="The BehaviourEvent data model is in place — pattern-detection logic ships in a later phase."
    />
  );
}
