import { AlertTriangle } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ViolationsTable, type ViolationRow } from "@/components/risk/violations-table";
import { getCurrentLotSize } from "@/lib/market-data/lot-sizes";
import { formatINR } from "@/lib/utils";

export default async function RuleViolationsPage() {
  const session = await requireSession();
  const violations = await prisma.ruleViolation.findMany({
    where: { ruleEvaluation: { trade: { userId: session.user.id } } },
    include: {
      ruleEvaluation: {
        include: {
          rule: true,
          trade: { include: { instrument: true, brokerAccount: { include: { broker: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalCost = violations.reduce((sum, v) => sum + Number(v.financialCost ?? 0), 0);

  const rows: ViolationRow[] = violations.map((v) => {
    const trade = v.ruleEvaluation.trade;
    const quantity = trade.quantity;
    const entryValue = quantity * Number(trade.entryAvgPrice);
    const exitValue = trade.exitAvgPrice ? quantity * Number(trade.exitAvgPrice) : null;
    // BUY-opened trade: entry is the buy leg, exit is the sell leg. SELL-opened
    // (short) trade: entry is the sell leg, exit is the buy-back leg.
    const buyValue = trade.side === "BUY" ? entryValue : exitValue;
    const sellValue = trade.side === "BUY" ? exitValue : entryValue;
    // Current lot size only (not historical — see lot-sizes.ts); null for
    // anything outside the top-10 underlyings this was calibrated for.
    const lotSize = getCurrentLotSize(trade.instrument.underlying);
    const lots = lotSize ? quantity / lotSize : null;

    return {
      id: v.id,
      tradeId: trade.id,
      symbol: trade.instrument.symbol,
      brokerName: trade.brokerAccount.nickname,
      ruleName: v.ruleEvaluation.rule.name,
      side: trade.side,
      quantity,
      entryPrice: Number(trade.entryAvgPrice),
      exitPrice: trade.exitAvgPrice ? Number(trade.exitAvgPrice) : null,
      lotSize,
      lots,
      buyValue,
      sellValue,
      grossPnl: trade.grossPnl ? Number(trade.grossPnl) : null,
      netPnl: trade.netPnl ? Number(trade.netPnl) : null,
      financialCost: v.financialCost ? Number(v.financialCost) : null,
      // The trade's own date, not when this violation record was written —
      // that was the bug (rule evaluation ran today for old trades, so
      // RuleViolation.createdAt showed today's date for every row).
      tradeDate: (trade.closedAt ?? trade.openedAt).toISOString(),
    };
  });

  return (
    <div>
      <PageHeader
        title="Rule Violations"
        description={
          violations.length > 0
            ? `${violations.length} violation${violations.length === 1 ? "" : "s"} · ${formatINR(totalCost)} total financial cost`
            : "Trades that broke one of your active trading rules."
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No rule violations" description="Every evaluated trade has complied with your active rules so far." />
      ) : (
        <ViolationsTable data={rows} />
      )}
    </div>
  );
}
