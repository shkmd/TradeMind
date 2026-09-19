import { CalendarCheck } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function WeeklyReviewPage() {
  return (
    <PlaceholderPage
      title="Weekly Review"
      description="A structured weekly retrospective: what worked, what didn't, and what to change."
      feature="Weekly review reports"
      phase={4}
      icon={CalendarCheck}
      emptyTitle="Weekly review coming soon"
      emptyDescription="Auto-generated weekly reviews ship alongside the Analytics and AI Coach modules."
    />
  );
}
