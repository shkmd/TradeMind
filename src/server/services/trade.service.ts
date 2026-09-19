import { prisma } from "@/lib/db/prisma";

export interface TradeListFilters {
  brokerAccountId?: string;
  instrumentSymbol?: string;
  status?: "OPEN" | "CLOSED" | "PARTIALLY_CLOSED";
}

export async function listClosedTrades(userId: string, filters: TradeListFilters = {}) {
  return prisma.trade.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(filters.brokerAccountId ? { brokerAccountId: filters.brokerAccountId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.instrumentSymbol ? { instrument: { symbol: filters.instrumentSymbol } } : {}),
    },
    include: {
      instrument: true,
      brokerAccount: { include: { broker: true } },
      journal: true,
    },
    orderBy: { openedAt: "desc" },
  });
}

export async function getTradeDetail(userId: string, tradeId: string) {
  return prisma.trade.findFirst({
    where: { id: tradeId, userId },
    include: {
      instrument: { include: { exchange: true } },
      brokerAccount: { include: { broker: true } },
      tradeExecutions: { include: { execution: true }, orderBy: { execution: { executedAt: "asc" } } },
      journal: { include: { emotion: true, mistakes: { include: { mistake: true } } } },
      ruleEvaluations: { include: { rule: true, violation: true } },
    },
  });
}
