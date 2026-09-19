import { Building2 } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function SectorExposurePage() {
  return (
    <PlaceholderPage
      title="Sector Exposure"
      description="Concentration risk across sectors, direct stocks and mutual fund overlap."
      feature="Sector exposure analysis"
      phase={3}
      icon={Building2}
      emptyTitle="Sector exposure coming with portfolio consolidation"
      emptyDescription="Instrument sector tagging and concentration analysis ship alongside full portfolio consolidation."
    />
  );
}
