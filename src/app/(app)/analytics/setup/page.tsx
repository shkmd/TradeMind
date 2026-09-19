import { Target } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function SetupAnalysisPage() {
  return (
    <PlaceholderPage
      title="Setup Analysis"
      description="Performance broken down by trade setup."
      feature="Setup Analysis"
      phase={4}
      icon={Target}
      emptyTitle="Setup analysis coming soon"
      emptyDescription="Tag trades by setup in your journal to unlock this breakdown once the Analytics module ships."
    />
  );
}
