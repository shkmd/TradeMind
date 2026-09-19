import Link from "next/link";
import { LineChart } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatINR } from "@/lib/utils";

export default async function OpenPositionsPage() {
  const session = await requireSession();
  const trades = await prisma.trade.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["OPEN", "PARTIALLY_CLOSED"] },
      deletedAt: null,
      // An unsold equity delivery buy is a holding, not a trading position
      // being actively managed — it belongs on Consolidated Holdings
      // instead (see that page for the other half of this).
      NOT: { productType: "DELIVERY", instrument: { segment: "EQUITY" } },
    },
    include: { instrument: true, brokerAccount: true },
    orderBy: { openedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Open Positions"
        description="F&O and intraday trades that haven't fully closed yet, across all brokers. Unsold equity delivery buys show on Consolidated Holdings instead."
      />
      {trades.length === 0 ? (
        <EmptyState icon={LineChart} title="No open positions" description="Every imported trade has been fully closed out." />
      ) : (
        <div className="space-y-2">
          {trades.map((t) => (
            <Link key={t.id} href={`/trading/trades/${t.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {t.instrument.symbol} <span className="text-muted-foreground">· {t.brokerAccount.nickname}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Opened {formatDate(t.openedAt)} · {t.quantity} qty @ {formatINR(t.entryAvgPrice.toString())}
                    </p>
                  </div>
                  <Badge variant="secondary">{t.status.replace("_", " ")}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
