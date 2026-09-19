import { TrendingUp } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function PortfolioPerformancePage() {
  return (
    <PlaceholderPage
      title="Portfolio Performance"
      description="XIRR, CAGR, time-weighted return and benchmark comparison for your investment holdings."
      feature="Portfolio performance analytics"
      phase={3}
      icon={TrendingUp}
      emptyTitle="Portfolio performance metrics coming soon"
      emptyDescription="XIRR/CAGR/TWR and Nifty/Sensex benchmark comparison ship with full portfolio consolidation."
    />
  );
}
