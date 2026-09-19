import { TrendingDown } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function DrawdownsPage() {
  return (
    <PlaceholderPage
      title="Drawdowns"
      description="Every drawdown period: depth, duration and recovery required."
      feature="Drawdown period tracking"
      phase={4}
      icon={TrendingDown}
      emptyTitle="Drawdown tracking coming soon"
      emptyDescription="Chronological, capital-based drawdown calculation ships alongside the Capital Protection Centre."
    />
  );
}
