import { Paperclip } from "lucide-react";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export default function AttachmentsPage() {
  return (
    <PlaceholderPage
      title="Screenshots & Attachments"
      description="Chart screenshots and voice notes attached to your trade journal entries."
      feature="Journal attachments"
      phase={3}
      icon={Paperclip}
      emptyTitle="Attachment uploads coming soon"
      emptyDescription="The Attachment data model and S3 storage are in place — the upload UI ships in a later phase."
    />
  );
}
