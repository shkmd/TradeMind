import { ArrowDownToLine } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function ProfitGiveBackPage() {
  return (
    <PlaceholderPage
      title="Profit Give-Back"
      description="Days where you gave back a meaningful chunk of peak intraday profit."
      feature="The Profit Give-Back Detector"
      phase={4}
      icon={ArrowDownToLine}
      emptyTitle="Profit give-back detection coming soon"
      emptyDescription="This compares peak intraday realized P&L against end-of-day P&L per trading day — ships in a later phase."
    />
  );
}
