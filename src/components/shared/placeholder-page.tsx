import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import type { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  feature,
  phase,
  icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  feature: string;
  phase: number;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <PhaseNotice feature={feature} phase={phase} />
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
