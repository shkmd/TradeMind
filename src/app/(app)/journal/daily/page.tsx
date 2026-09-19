import { NotebookPen } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function DailyJournalPage() {
  const session = await requireSession();
  const entries = await prisma.dailyJournal.findMany({
    where: { userId: session.user.id },
    include: { openingEmotion: true },
    orderBy: { journalDate: "desc" },
  });

  return (
    <div>
      <PageHeader title="Daily Journal" description="Your market outlook, plan and end-of-day reflection for each trading day." />
      {entries.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No daily journal entries yet" description="Start logging your daily plan and reflection to build a discipline trail." />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <CardTitle className="text-foreground">{formatDate(entry.journalDate)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {entry.marketOutlook && (
                  <p>
                    <span className="font-medium">Outlook: </span>
                    {entry.marketOutlook}
                  </p>
                )}
                {entry.endOfDayReflection && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Reflection: </span>
                    {entry.endOfDayReflection}
                  </p>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {entry.maxTrades && <span>Max trades: {entry.maxTrades}</span>}
                  {entry.openingEmotion && <span>Opening emotion: {entry.openingEmotion.label}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
