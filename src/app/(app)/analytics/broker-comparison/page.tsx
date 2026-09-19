import { Scale } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function BrokerComparisonPage() {
  return (
    <PlaceholderPage
      title="Broker Comparison"
      description="Side-by-side performance comparison across your connected broker accounts."
      feature="Broker Comparison"
      phase={4}
      icon={Scale}
      emptyTitle="Broker comparison coming soon"
      emptyDescription="Connect a second broker account to unlock this comparison once the Analytics module ships."
    />
  );
}
