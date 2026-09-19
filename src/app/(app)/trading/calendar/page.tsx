import { CalendarRange } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate, formatINR } from "@/lib/utils";

export default async function TradingCalendarPage() {
  const session = await requireSession();
  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id, closedAt: { not: null }, deletedAt: null },
    select: { closedAt: true, netPnl: true },
  });

  if (trades.length === 0) {
    return (
      <div>
        <PageHeader title="Trading Calendar" description="Daily net P&L across every closed trade." />
        <EmptyState icon={CalendarRange} title="No closed trades yet" description="Your P&L calendar fills in as trades close." />
      </div>
    );
  }

  const byDay = new Map<string, number>();
  for (const t of trades) {
    if (!t.closedAt) continue;
    const key = t.closedAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(t.netPnl ?? 0));
  }
  const days = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div>
      <PageHeader title="Trading Calendar" description="Net P&L per trading day, most recent first." />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {days.map(([date, pnl]) => (
          <Card key={date}>
            <CardContent className="flex items-center justify-between p-4">
              <span className="text-sm text-muted-foreground">{formatDate(date)}</span>
              <span className={cn("financial-figure text-lg", pnl >= 0 ? "text-success" : "text-danger")}>
                {formatINR(pnl)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
