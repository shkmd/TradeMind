import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function TimeAnalysisPage() {
  return (
    <PlaceholderPage
      title="Time Analysis"
      description="Performance by day of week, time of day and expiry vs. non-expiry days."
      feature="Time Analysis"
      phase={4}
      icon={Clock}
      emptyTitle="Time-based analysis coming soon"
      emptyDescription="Day-of-week and time-of-day performance breakdowns ship with the Analytics module."
    />
  );
}
