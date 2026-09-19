import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { listClosedTrades } from "@/server/services/trade.service";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { TradesTable, type TradeRow } from "@/components/trades/trades-table";

export default async function TradesPage() {
  const session = await requireSession();
  const trades = await listClosedTrades(session.user.id);

  const rows: TradeRow[] = trades.map((t) => ({
    id: t.id,
    symbol: t.instrument.symbol,
    brokerName: t.brokerAccount.nickname,
    side: t.side,
    productType: t.productType,
    status: t.status,
    openedAt: t.openedAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    entryAvgPrice: Number(t.entryAvgPrice),
    exitAvgPrice: t.exitAvgPrice ? Number(t.exitAvgPrice) : null,
    grossPnl: t.grossPnl ? Number(t.grossPnl) : null,
    totalCharges: t.totalCharges ? Number(t.totalCharges) : null,
    netPnl: t.netPnl ? Number(t.netPnl) : null,
    processScore: t.processScore,
    ruleComplianceScore: t.ruleComplianceScore,
    journaled: Boolean(t.journal?.completedAt),
  }));

  return (
    <div>
      <PageHeader title="Closed Trades" description="Every trade generated from your imported executions." />
      {rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No trades yet"
          description="Import a broker tradebook to see your trades here, complete with charges, process score and rule compliance."
          action={
            <Button asChild>
              <Link href="/imports/new">Import trades</Link>
            </Button>
          }
        />
      ) : (
        <TradesTable data={rows} />
      )}
    </div>
  );
}
