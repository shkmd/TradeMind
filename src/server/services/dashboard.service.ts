import { prisma } from "@/lib/db/prisma";

export interface DashboardFilters {
  brokerAccountId?: string;
  from?: Date;
  to?: Date;
}

export interface DashboardData {
  realizedPnl: number;
  netPnl: number;
  totalCharges: number;
  todaysPnl: number;
  winRate: number | null;
  tradeCount: number;
  closedTradeCount: number;
  avgProcessScore: number | null;
  avgRuleCompliance: number | null;
  equityCurve: { date: string; cumulativeNetPnl: number }[];
  pnlByInstrument: { symbol: string; netPnl: number }[];
  connectedBrokerAccounts: { id: string; nickname: string; brokerName: string; lastSyncedAt: Date | null }[];
  behaviouralWarning: string | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData(userId: string, filters: DashboardFilters = {}): Promise<DashboardData> {
  const where = {
    userId,
    deletedAt: null,
    ...(filters.brokerAccountId ? { brokerAccountId: filters.brokerAccountId } : {}),
    ...(filters.from || filters.to
      ? {
          openedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const trades = await prisma.trade.findMany({
    where,
    include: { instrument: true },
    orderBy: { closedAt: "asc" },
  });

  const closedTrades = trades.filter((t) => t.status === "CLOSED" || t.status === "PARTIALLY_CLOSED");

  const realizedPnl = closedTrades.reduce((sum, t) => sum + Number(t.grossPnl ?? 0), 0);
  const netPnl = trades.reduce((sum, t) => sum + Number(t.netPnl ?? 0), 0);
  const totalCharges = trades.reduce((sum, t) => sum + Number(t.totalCharges ?? 0), 0);

  const today = startOfToday();
  const todaysPnl = trades
    .filter((t) => t.closedAt && t.closedAt >= today)
    .reduce((sum, t) => sum + Number(t.netPnl ?? 0), 0);

  const winners = closedTrades.filter((t) => Number(t.netPnl ?? 0) > 0);
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : null;

  const scored = trades.filter((t) => t.processScore !== null);
  const avgProcessScore =
    scored.length > 0 ? scored.reduce((sum, t) => sum + (t.processScore ?? 0), 0) / scored.length : null;

  const withCompliance = trades.filter((t) => t.ruleComplianceScore !== null);
  const avgRuleCompliance =
    withCompliance.length > 0
      ? withCompliance.reduce((sum, t) => sum + (t.ruleComplianceScore ?? 0), 0) / withCompliance.length
      : null;

  let cumulative = 0;
  const equityCurve = closedTrades
    .filter((t) => t.closedAt)
    .map((t) => {
      cumulative += Number(t.netPnl ?? 0);
      return { date: t.closedAt!.toISOString().slice(0, 10), cumulativeNetPnl: Math.round(cumulative * 100) / 100 };
    });

  const pnlBySymbol = new Map<string, number>();
  for (const trade of trades) {
    const key = trade.instrument.symbol;
    pnlBySymbol.set(key, (pnlBySymbol.get(key) ?? 0) + Number(trade.netPnl ?? 0));
  }
  const pnlByInstrument = Array.from(pnlBySymbol.entries())
    .map(([symbol, netPnl]) => ({ symbol, netPnl: Math.round(netPnl * 100) / 100 }))
    .sort((a, b) => b.netPnl - a.netPnl);

  const brokerAccounts = await prisma.brokerAccount.findMany({
    where: { userId, deletedAt: null, isActive: true },
    include: { broker: true, connections: true },
  });
  const connectedBrokerAccounts = brokerAccounts.map((a) => ({
    id: a.id,
    nickname: a.nickname,
    brokerName: a.broker.name,
    lastSyncedAt: a.connections[0]?.lastSyncedAt ?? null,
  }));

  const violationCount = await prisma.ruleViolation.count({
    where: { ruleEvaluation: { trade: { userId } } },
  });
  const behaviouralWarning =
    violationCount > 0
      ? `${violationCount} rule violation${violationCount === 1 ? "" : "s"} detected across your trading history — see Risk & Behaviour for details.`
      : null;

  return {
    realizedPnl: round2(realizedPnl),
    netPnl: round2(netPnl),
    totalCharges: round2(totalCharges),
    todaysPnl: round2(todaysPnl),
    winRate,
    tradeCount: trades.length,
    closedTradeCount: closedTrades.length,
    avgProcessScore,
    avgRuleCompliance,
    equityCurve,
    pnlByInstrument,
    connectedBrokerAccounts,
    behaviouralWarning,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
