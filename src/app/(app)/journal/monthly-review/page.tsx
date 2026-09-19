import { CalendarRange } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function MonthlyReviewPage() {
  return (
    <PlaceholderPage
      title="Monthly Review"
      description="A monthly rollup of performance, process score trend and behavioural patterns."
      feature="Monthly review reports"
      phase={4}
      icon={CalendarRange}
      emptyTitle="Monthly review coming soon"
      emptyDescription="Auto-generated monthly reviews ship alongside the Analytics and AI Coach modules."
    />
  );
}
