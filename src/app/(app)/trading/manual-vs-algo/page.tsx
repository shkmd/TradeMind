import { Network } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function ManualVsAlgoPage() {
  return (
    <PlaceholderPage
      title="Manual vs Algo"
      description="Compare performance between manually placed trades and algo-executed trades."
      feature="Manual vs algo breakdown"
      phase={3}
      icon={Network}
      emptyTitle="Manual vs algo comparison coming soon"
      emptyDescription="All imported trades are currently tagged manual. Algo-source tagging ships in a later phase."
    />
  );
}
