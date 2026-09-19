import { FileBarChart } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function WeeklyCoachReportPage() {
  return (
    <PlaceholderPage
      title="Weekly Coach Report"
      description="A weekly, evidence-backed summary of your trading process and outcomes."
      feature="Weekly Coach Report"
      phase={5}
      icon={FileBarChart}
      emptyTitle="Weekly coach report coming soon"
      emptyDescription="This ships alongside the AI Coach module."
    />
  );
}
