import { PieChart } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function AssetAllocationPage() {
  return (
    <PlaceholderPage
      title="Asset Allocation"
      description="How your consolidated portfolio splits across equities, ETFs, mutual funds, bonds and more."
      feature="Asset allocation breakdown"
      phase={3}
      icon={PieChart}
      emptyTitle="Allocation charts coming with portfolio consolidation"
      emptyDescription="This will break down your holdings by asset class once multi-broker portfolio consolidation ships."
    />
  );
}
