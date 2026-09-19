import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";

export default function AiChatPage() {
  return (
    <div>
      <PageHeader title="AI Chat" description="Ask questions about your own trading history — never market predictions or trade signals." />
      <PhaseNotice feature="The AI Coach" phase={5} />
      <EmptyState
        icon={MessageSquare}
        title="AI Coach coming soon"
        description="Every answer will cite the finding, date range, sample size, exact calculation, financial impact and supporting trades — never a price prediction or trade signal."
      />
    </div>
  );
}
