import { Landmark } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function DividendsPage() {
  return (
    <PlaceholderPage
      title="Dividends"
      description="Dividend income received across all your holdings and broker accounts."
      feature="Dividend history"
      phase={3}
      icon={Landmark}
      emptyTitle="Dividend tracking coming soon"
      emptyDescription="Dividend records are captured as corporate actions once that pipeline ships."
    />
  );
}
