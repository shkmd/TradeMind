import { Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR, formatPercent } from "@/lib/utils";

interface HoldingRow {
  id: string;
  symbol: string;
  brokerNickname: string;
  quantity: number;
  avgCostPrice: number;
  currentPrice: number | null;
  previousClose: number | null;
}

export default async function HoldingsPage() {
  const session = await requireSession();
  const liveSyncedHoldings = await prisma.holding.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: { instrument: true, brokerAccount: true },
    orderBy: { createdAt: "desc" },
  });

  // CSV imports never populate Holding (only live broker-API sync does —
  // see broker-connect.service.ts) — without this, every unsold equity
  // delivery buy from a CSV-imported account would have nowhere to show up
  // as a holding at all. But a CSV-derived "still open" position can be
  // stale: the export's date range (or a row that failed to parse) can
  // miss the actual closing sell, leaving a position that's genuinely
  // already gone showing as open here forever. A successful live sync is
  // the authoritative current state for that broker account — once one
  // exists, trust it completely and stop falling back to CSV-derived
  // guesses for that same account, rather than only skipping the specific
  // instruments the live sync happened to match.
  const liveTrackedBrokerAccountIds = new Set(liveSyncedHoldings.map((h) => h.brokerAccountId));
  const openDeliveryTrades = await prisma.trade.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      status: { in: ["OPEN", "PARTIALLY_CLOSED"] },
      productType: "DELIVERY",
      instrument: { segment: "EQUITY" },
      brokerAccountId: { notIn: Array.from(liveTrackedBrokerAccountIds) },
    },
    include: { instrument: true, brokerAccount: true },
    orderBy: { openedAt: "desc" },
  });

  const holdings: HoldingRow[] = [
    ...liveSyncedHoldings.map((h) => ({
      id: h.id,
      symbol: h.instrument.symbol,
      brokerNickname: h.brokerAccount.nickname,
      quantity: Number(h.quantity),
      avgCostPrice: Number(h.avgCostPrice),
      currentPrice: h.currentPrice ? Number(h.currentPrice) : null,
      previousClose: h.previousClose ? Number(h.previousClose) : null,
    })),
    ...openDeliveryTrades.map((t) => ({
      id: t.id,
      symbol: t.instrument.symbol,
      brokerNickname: t.brokerAccount.nickname,
      quantity: t.quantity,
      avgCostPrice: Number(t.entryAvgPrice),
      currentPrice: null, // no live price feed for CSV-imported positions
      previousClose: null,
    })),
  ];

  // Invested amount is knowable for every holding regardless of live
  // pricing (cost basis is always on file); gain figures only make sense
  // over holdings with a known current price, so they're computed
  // separately rather than treating a missing price as zero.
  const totalInvested = holdings.reduce((sum, h) => sum + h.avgCostPrice * h.quantity, 0);
  const pricedHoldings = holdings.filter((h) => h.currentPrice !== null);
  const currentValue = pricedHoldings.reduce((sum, h) => sum + h.currentPrice! * h.quantity, 0);
  const investedForPriced = pricedHoldings.reduce((sum, h) => sum + h.avgCostPrice * h.quantity, 0);
  const overallGain = currentValue - investedForPriced;
  const overallGainPct = investedForPriced !== 0 ? (overallGain / investedForPriced) * 100 : null;

  const holdingsWithPrevClose = holdings.filter((h) => h.currentPrice !== null && h.previousClose !== null);
  const todaysGain = holdingsWithPrevClose.reduce(
    (sum, h) => sum + (h.currentPrice! - h.previousClose!) * h.quantity,
    0
  );
  const todaysBaseValue = holdingsWithPrevClose.reduce((sum, h) => sum + h.previousClose! * h.quantity, 0);
  const todaysGainPct = todaysBaseValue !== 0 ? (todaysGain / todaysBaseValue) * 100 : null;
  const unpricedCount = holdings.length - pricedHoldings.length;

  return (
    <div>
      <PageHeader title="Consolidated Holdings" description="Holdings consolidated across all connected broker accounts." />
      <PhaseNotice feature="Multi-broker ISIN consolidation and corporate-action adjustment" phase={3} />

      {holdings.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total holdings" value={String(holdings.length)} />
          <KpiCard label="Invested amount" value={formatINR(totalInvested)} />
          <KpiCard label="Current value" value={formatINR(currentValue)} />
          <KpiCard
            label="Overall gain"
            value={`${formatINR(overallGain)}${overallGainPct !== null ? ` (${formatPercent(overallGainPct)})` : ""}`}
            tone={overallGain >= 0 ? "positive" : "negative"}
            sublabel={unpricedCount > 0 ? `${unpricedCount} holding${unpricedCount === 1 ? "" : "s"} without a live price, excluded` : undefined}
          />
          <KpiCard
            label="Today's gain"
            value={
              holdingsWithPrevClose.length > 0
                ? `${formatINR(todaysGain)}${todaysGainPct !== null ? ` (${formatPercent(todaysGainPct)})` : ""}`
                : "—"
            }
            tone={holdingsWithPrevClose.length > 0 ? (todaysGain >= 0 ? "positive" : "negative") : "neutral"}
          />
        </div>
      )}

      {holdings.length === 0 ? (
        <EmptyState icon={Wallet} title="No holdings yet" description="Delivery holdings will appear here once imported or entered manually." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Avg cost</TableHead>
                <TableHead>Current price</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Unrealised P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const value = h.currentPrice !== null ? h.currentPrice * h.quantity : null;
                const unrealised = h.currentPrice !== null ? (h.currentPrice - h.avgCostPrice) * h.quantity : null;
                const unrealisedPct =
                  h.currentPrice !== null ? ((h.currentPrice - h.avgCostPrice) / h.avgCostPrice) * 100 : null;
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">{h.brokerNickname}</TableCell>
                    <TableCell>{h.quantity}</TableCell>
                    <TableCell>{formatINR(h.avgCostPrice)}</TableCell>
                    <TableCell>{h.currentPrice !== null ? formatINR(h.currentPrice) : "—"}</TableCell>
                    <TableCell>{value !== null ? formatINR(value) : "—"}</TableCell>
                    <TableCell className={unrealised === null ? "text-muted-foreground" : unrealised >= 0 ? "text-success" : "text-danger"}>
                      {unrealised !== null ? `${formatINR(unrealised)} (${formatPercent(unrealisedPct)})` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
