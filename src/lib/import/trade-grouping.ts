import Decimal from "decimal.js";
import type { TradeSide, TradeStatus, TradeProductType } from "@prisma/client";
import { computeLotPnl, sumGrossPnl } from "@/lib/calculations/pnl";
import { computeWeightedAveragePrice } from "@/lib/calculations/weighted-average-price";

export interface ExecutionForGrouping {
  id: string;
  side: TradeSide;
  quantity: number;
  price: Decimal;
  executedAt: Date;
}

export interface GroupedTradeExecution {
  executionId: string;
  role: "ENTRY" | "EXIT";
  matchedQuantity: number;
}

export interface GroupedTrade {
  side: TradeSide;
  status: TradeStatus;
  productType: TradeProductType;
  openedAt: Date;
  closedAt: Date | null;
  /** Total quantity that was ever open in this trade (peak position size, not net). */
  quantity: number;
  entryAvgPrice: Decimal;
  exitAvgPrice: Decimal | null;
  grossPnl: Decimal;
  tradeExecutions: GroupedTradeExecution[];
}

interface OpenLot {
  executionId: string;
  price: Decimal;
  remainingQty: number;
}

interface InProgressTrade {
  side: TradeSide;
  openedAt: Date;
  entryLots: { price: Decimal; quantity: number }[];
  exitLots: { price: Decimal; quantity: number }[];
  lotPnls: Decimal[];
  openQueue: OpenLot[];
  totalEntryQty: number;
  /** executionId -> accumulated matched quantity for this role, so a single execution spanning multiple internal lot-matches still produces one TradeExecution row (schema is one row per trade+execution+role). */
  entryMatches: Map<string, number>;
  exitMatches: Map<string, number>;
  closedAt: Date | null;
}

function classifyProductType(trade: InProgressTrade, status: TradeStatus): TradeProductType {
  if (status !== "CLOSED" || !trade.closedAt) return "DELIVERY";
  const sameDay = trade.openedAt.toDateString() === trade.closedAt.toDateString();
  return sameDay ? "INTRADAY" : "DELIVERY";
}

function finalizeTrade(trade: InProgressTrade, status: TradeStatus): GroupedTrade {
  const entryAvgPrice = computeWeightedAveragePrice(
    trade.entryLots.map((l) => ({ quantity: new Decimal(l.quantity), price: l.price }))
  );
  const exitAvgPrice =
    trade.exitLots.length > 0
      ? computeWeightedAveragePrice(
          trade.exitLots.map((l) => ({ quantity: new Decimal(l.quantity), price: l.price }))
        )
      : null;

  const tradeExecutions: GroupedTradeExecution[] = [
    ...Array.from(trade.entryMatches.entries()).map(([executionId, matchedQuantity]) => ({
      executionId,
      role: "ENTRY" as const,
      matchedQuantity,
    })),
    ...Array.from(trade.exitMatches.entries()).map(([executionId, matchedQuantity]) => ({
      executionId,
      role: "EXIT" as const,
      matchedQuantity,
    })),
  ];

  const productType = classifyProductType(trade, status);

  return {
    side: trade.side,
    status,
    productType,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    quantity: trade.totalEntryQty,
    entryAvgPrice,
    exitAvgPrice,
    grossPnl: sumGrossPnl(trade.lotPnls),
    tradeExecutions,
  };
}

function addMatch(map: Map<string, number>, executionId: string, qty: number) {
  map.set(executionId, (map.get(executionId) ?? 0) + qty);
}

/**
 * FIFO-groups a chronologically-processed stream of same-instrument,
 * same-account, same-segment executions into round-trip Trades. Opposite-
 * side fills consume the oldest open lots first; a fill larger than the
 * remaining open position flips direction into a brand-new trade.
 *
 * Pure function — no DB access — so it's independently unit-testable.
 */
export function groupExecutionsIntoTrades(executions: ExecutionForGrouping[]): GroupedTrade[] {
  const sorted = [...executions].sort((a, b) => {
    const diff = a.executedAt.getTime() - b.executedAt.getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const results: GroupedTrade[] = [];
  let current: InProgressTrade | null = null;

  function startTrade(side: TradeSide, openedAt: Date): InProgressTrade {
    return {
      side,
      openedAt,
      entryLots: [],
      exitLots: [],
      lotPnls: [],
      openQueue: [],
      totalEntryQty: 0,
      entryMatches: new Map(),
      exitMatches: new Map(),
      closedAt: null,
    };
  }

  for (const execution of sorted) {
    if (!current) {
      current = startTrade(execution.side, execution.executedAt);
    }

    if (execution.side === current.side) {
      // Scale-in: extends the open position in the same direction.
      current.openQueue.push({
        executionId: execution.id,
        price: execution.price,
        remainingQty: execution.quantity,
      });
      current.entryLots.push({ price: execution.price, quantity: execution.quantity });
      current.totalEntryQty += execution.quantity;
      addMatch(current.entryMatches, execution.id, execution.quantity);
      continue;
    }

    // Opposite side: consume open lots FIFO (oldest first).
    let remainingExitQty = execution.quantity;
    let consumedByThisExecution = 0;

    while (remainingExitQty > 0 && current.openQueue.length > 0) {
      const lot = current.openQueue[0]!;
      const matchedQty = Math.min(lot.remainingQty, remainingExitQty);

      current.lotPnls.push(computeLotPnl(lot.price, execution.price, new Decimal(matchedQty), current.side));

      lot.remainingQty -= matchedQty;
      remainingExitQty -= matchedQty;
      consumedByThisExecution += matchedQty;

      if (lot.remainingQty === 0) current.openQueue.shift();
    }

    if (consumedByThisExecution > 0) {
      current.exitLots.push({ price: execution.price, quantity: consumedByThisExecution });
      addMatch(current.exitMatches, execution.id, consumedByThisExecution);
    }

    if (current.openQueue.length === 0) {
      // Position fully closed.
      current.closedAt = execution.executedAt;
      results.push(finalizeTrade(current, "CLOSED"));
      current = null;

      if (remainingExitQty > 0) {
        // Execution was larger than the open position — the remainder
        // flips direction and opens a brand-new trade.
        current = startTrade(execution.side, execution.executedAt);
        current.openQueue.push({
          executionId: execution.id,
          price: execution.price,
          remainingQty: remainingExitQty,
        });
        current.entryLots.push({ price: execution.price, quantity: remainingExitQty });
        current.totalEntryQty += remainingExitQty;
        addMatch(current.entryMatches, execution.id, remainingExitQty);
      }
    }
    // else: position partially reduced but still open — stays `current`,
    // handled (and finalized as OPEN/PARTIALLY_CLOSED) after the loop.
  }

  if (current) {
    const status: TradeStatus = current.exitLots.length > 0 ? "PARTIALLY_CLOSED" : "OPEN";
    results.push(finalizeTrade(current, status));
  }

  return results;
}
