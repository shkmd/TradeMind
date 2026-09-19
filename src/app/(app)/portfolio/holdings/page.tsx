import { Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR, formatPercent } from "@/lib/utils";

interface HoldingRow {
  id: string;
  symbol: string;
  brokerNickname: string;
  quantity: number;
  avgCostPrice: number;
  currentPrice: number | null;
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
    })),
    ...openDeliveryTrades.map((t) => ({
      id: t.id,
      symbol: t.instrument.symbol,
      brokerNickname: t.brokerAccount.nickname,
      quantity: t.quantity,
      avgCostPrice: Number(t.entryAvgPrice),
      currentPrice: null, // no live price feed for CSV-imported positions
    })),
  ];

  return (
    <div>
      <PageHeader title="Consolidated Holdings" description="Holdings consolidated across all connected broker accounts." />
      <PhaseNotice feature="Multi-broker ISIN consolidation and corporate-action adjustment" phase={3} />

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
