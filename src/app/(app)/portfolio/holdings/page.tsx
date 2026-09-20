import { Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { HoldingsView, type HoldingViewRow } from "@/components/portfolio/holdings-view";
import { isLikelyETF } from "@/lib/market-data/is-etf";

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

  const holdings: HoldingViewRow[] = [
    ...liveSyncedHoldings.map((h) => ({
      id: h.id,
      symbol: h.instrument.symbol,
      brokerNickname: h.brokerAccount.nickname,
      instrumentType: isLikelyETF(h.instrument.symbol) ? ("ETF" as const) : ("STOCK" as const),
      quantity: Number(h.quantity),
      avgCostPrice: Number(h.avgCostPrice),
      currentPrice: h.currentPrice ? Number(h.currentPrice) : null,
      previousClose: h.previousClose ? Number(h.previousClose) : null,
    })),
    ...openDeliveryTrades.map((t) => ({
      id: t.id,
      symbol: t.instrument.symbol,
      brokerNickname: t.brokerAccount.nickname,
      instrumentType: isLikelyETF(t.instrument.symbol) ? ("ETF" as const) : ("STOCK" as const),
      quantity: t.quantity,
      avgCostPrice: Number(t.entryAvgPrice),
      currentPrice: null, // no live price feed for CSV-imported positions
      previousClose: null,
    })),
  ];

  return (
    <div>
      <PageHeader title="Consolidated Holdings" description="Holdings consolidated across all connected broker accounts." />
      <PhaseNotice feature="Multi-broker ISIN consolidation and corporate-action adjustment" phase={3} />

      {holdings.length === 0 ? (
        <EmptyState icon={Wallet} title="No holdings yet" description="Delivery holdings will appear here once imported or entered manually." />
      ) : (
        <HoldingsView holdings={holdings} />
      )}
    </div>
  );
}
