import { Lightbulb } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function AiInsightsPage() {
  return (
    <PlaceholderPage
      title="AI Insights"
      description="Evidence-linked, deterministic-calculation-backed insights about your trading."
      feature="AI Insights"
      phase={5}
      icon={Lightbulb}
      emptyTitle="AI Insights coming soon"
      emptyDescription="Insights will always link back to supporting trades and never fabricate data."
    />
  );
}
