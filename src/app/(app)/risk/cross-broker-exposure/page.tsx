import { Network } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function CrossBrokerExposurePage() {
  return (
    <PlaceholderPage
      title="Cross-Broker Exposure"
      description="Combined risk and exposure across all broker accounts, not each in isolation."
      feature="Cross-broker risk intelligence"
      phase={4}
      icon={Network}
      emptyTitle="Cross-broker exposure coming soon"
      emptyDescription="Global risk limits that apply across every connected broker account ship in a later phase."
    />
  );
}
