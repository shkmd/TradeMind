import { Layers } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function OptionsStrategiesPage() {
  return (
    <PlaceholderPage
      title="Options Strategies"
      description="Automatically detected multi-leg strategies: spreads, straddles, iron condors and more."
      feature="Options strategy detection"
      phase={3}
      icon={Layers}
      emptyTitle="Options strategy grouping coming soon"
      emptyDescription="This build imports Zerodha equity trades only — options-leg grouping ships in a later phase."
    />
  );
}
