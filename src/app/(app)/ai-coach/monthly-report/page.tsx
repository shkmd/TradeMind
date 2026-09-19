import { FileBarChart } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function MonthlyCoachReportPage() {
  return (
    <PlaceholderPage
      title="Monthly Coach Report"
      description="A monthly, evidence-backed summary of your trading process and outcomes."
      feature="Monthly Coach Report"
      phase={5}
      icon={FileBarChart}
      emptyTitle="Monthly coach report coming soon"
      emptyDescription="This ships alongside the AI Coach module."
    />
  );
}
