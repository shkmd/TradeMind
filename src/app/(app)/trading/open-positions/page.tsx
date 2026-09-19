import Link from "next/link";
import { LineChart, TriangleAlert } from "lucide-react";
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

  // A F&O contract cannot still be genuinely "open" past its own expiry —
  // by expiry every option/future is either exercised, assigned, or expires
  // worthless. No execution row here just means the broker's export never
  // recorded that settlement (common for worthless-expiry options), not
  // that the position is still live. The underlying P&L figures (this
  // trade's realized P&L, and anything that rolls it up) stay understated
  // until it's reconciled against the broker's own P&L report and properly
  // closed — flagging it rather than hiding it.
  const now = new Date();
  const expiredCount = trades.filter((t) => t.instrument.expiryDate && t.instrument.expiryDate < now).length;

  return (
    <div>
      <PageHeader
        title="Open Positions"
        description="F&O and intraday trades that haven't fully closed yet, across all brokers. Unsold equity delivery buys show on Consolidated Holdings instead."
      />
      {expiredCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">
              {expiredCount} position{expiredCount === 1 ? "" : "s"} past expiry with no closing execution on file.
            </span>{" "}
            These are flagged below rather than shown as genuinely open — until reconciled against your broker&apos;s
            own P&amp;L report, realized P&amp;L for these (and anything that rolls it up) is understated.
          </p>
        </div>
      )}
      {trades.length === 0 ? (
        <EmptyState icon={LineChart} title="No open positions" description="Every imported trade has been fully closed out." />
      ) : (
        <div className="space-y-2">
          {trades.map((t) => {
            const isExpiredUnresolved = t.instrument.expiryDate ? t.instrument.expiryDate < now : false;
            return (
              <Link key={t.id} href={`/trading/trades/${t.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {t.instrument.symbol} <span className="text-muted-foreground">· {t.brokerAccount.nickname}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Opened {formatDate(t.openedAt)} · {t.quantity} qty @ {formatINR(t.entryAvgPrice.toString())}
                        {isExpiredUnresolved && (
                          <> · expired {formatDate(t.instrument.expiryDate!)}, no closing execution on file</>
                        )}
                      </p>
                    </div>
                    {isExpiredUnresolved ? (
                      <Badge variant="warning">Expired — unresolved</Badge>
                    ) : (
                      <Badge variant="secondary">{t.status.replace("_", " ")}</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
