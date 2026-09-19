import { Gift } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function CorporateActionsPage() {
  return (
    <PlaceholderPage
      title="Corporate Actions"
      description="Splits, bonuses, rights issues, mergers and demergers affecting your holdings."
      feature="Corporate action processing"
      phase={3}
      icon={Gift}
      emptyTitle="Corporate action handling coming soon"
      emptyDescription="Splits, bonuses and other corporate actions will automatically adjust your holdings once this pipeline ships."
    />
  );
}
