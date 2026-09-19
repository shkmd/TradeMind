import { Bell } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Notifications" description="Import status, risk alerts and review reminders." />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
