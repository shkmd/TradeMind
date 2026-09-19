import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function AnalyticsPerformancePage() {
  return (
    <PlaceholderPage
      title="Performance"
      description="Profit factor, expectancy, Sharpe/Sortino, recovery factor and more."
      feature="Full performance analytics"
      phase={4}
      icon={BarChart3}
      emptyTitle="Deeper performance metrics coming soon"
      emptyDescription="The dashboard already shows core P&L, win rate and process score — deeper metrics ship with the Analytics module."
    />
  );
}
