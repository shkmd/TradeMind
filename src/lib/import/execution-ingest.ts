import Decimal from "decimal.js";
import type { TradeProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CanonicalExecutionRow } from "@/lib/brokers/adapter";
import { fingerprintForCanonicalRow } from "@/lib/import/dedup";
import { groupExecutionsIntoTrades, type ExecutionForGrouping } from "@/lib/import/trade-grouping";
import { composeChargeBreakdown } from "@/lib/calculations/charges/multi-broker-equity";
import { calculateRegulatoryCharges } from "@/lib/calculations/charges/regulatory";
import { getBrokerageFormula } from "@/lib/calculations/charges/brokerage-formulas";
import { aggregateOrders, attributeLegBrokerage } from "@/lib/calculations/charges/order-brokerage";
import type { ChargeSegment } from "@/lib/calculations/charges/types";
import { resolveInstrument } from "@/server/services/instrument.service";
import { evaluateAndScoreTrade } from "@/server/services/trade-scoring.service";

export interface PersistExecutionResult {
  status: "IMPORTED" | "DUPLICATE";
  executionId?: string;
  instrumentId?: string;
  fingerprint: string;
}

/**
 * Shared by both the CSV import pipeline and the live broker-API sync: given
 * one canonical execution row, dedupe-checks it by fingerprint and persists
 * a new Execution if it's genuinely new. Never silently drops a duplicate —
 * callers decide what to do with the DUPLICATE status (CSV import records it
 * on the ImportRow; live sync just skips it since there's no row to annotate).
 */
export async function persistExecutionIfNew(
  brokerAccountId: string,
  row: CanonicalExecutionRow
): Promise<PersistExecutionResult> {
  const fingerprint = fingerprintForCanonicalRow(brokerAccountId, row);
  const existing = await prisma.execution.findUnique({ where: { fingerprint } });
  if (existing) {
    return { status: "DUPLICATE", fingerprint };
  }

  const instrument = await resolveInstrument({
    exchangeCode: row.exchange,
    symbol: row.symbol,
    isin: row.isin,
    rawSegment: row.segment,
    series: row.series,
    derivative: row.derivative,
  });

  const execution = await prisma.execution.create({
    data: {
      brokerAccountId,
      instrumentId: instrument.id,
      brokerTradeId: row.brokerTradeId,
      brokerOrderId: row.brokerOrderId,
      side: row.side,
      quantity: row.quantity,
      price: row.price,
      exchange: row.exchange,
      segment: row.segment,
      series: row.series,
      executedAt: row.executedAt,
      fingerprint,
    },
  });

  return { status: "IMPORTED", executionId: execution.id, instrumentId: instrument.id, fingerprint };
}

/**
 * Re-groups ALL executions (old + newly imported) for each touched
 * instrument into Trades, replacing any Trade rows previously generated for
 * that (brokerAccount, instrument) pair. Used after both CSV imports and
 * live-sync pulls — see the reconciliation caveat in pipeline.ts.
 */
export async function regenerateTradesForInstruments(
  userId: string,
  brokerAccountId: string,
  instrumentIds: string[]
): Promise<number> {
  let tradesCreated = 0;

  const brokerAccount = await prisma.brokerAccount.findUniqueOrThrow({
    where: { id: brokerAccountId },
    include: { broker: true },
  });
  const brokerCode = brokerAccount.broker.code;

  for (const instrumentId of instrumentIds) {
    const executions = await prisma.execution.findMany({
      where: { brokerAccountId, instrumentId, deletedAt: null },
      orderBy: { executedAt: "asc" },
    });

    // Always clear stale trades for this instrument first, even when zero
    // executions remain (e.g. an import rollback soft-deleted all of them) —
    // otherwise a rollback would leave orphaned Trade rows with no backing
    // executions.
    await prisma.trade.deleteMany({ where: { userId, brokerAccountId, instrumentId } });
    if (executions.length === 0) continue;

    const instrument = await prisma.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
    // InstrumentSegment ("EQUITY"|"FUTURES"|"OPTIONS"|"CURRENCY"|"COMMODITY"|"MUTUAL_FUND")
    // maps directly onto ChargeSegment for the two values the charge engine
    // knows about; anything else (CURRENCY/COMMODITY-as-cash/MUTUAL_FUND)
    // isn't F&O and is priced as equity, matching prior behavior for those
    // still-unimplemented segments.
    const chargeSegment: ChargeSegment =
      instrument.segment === "FUTURES" || instrument.segment === "OPTIONS" ? instrument.segment : "EQUITY";

    const executionsBySegment = new Map<string, typeof executions>();
    for (const execution of executions) {
      const list = executionsBySegment.get(execution.segment) ?? [];
      list.push(execution);
      executionsBySegment.set(execution.segment, list);
    }

    for (const [, segmentExecutions] of executionsBySegment) {
      const forGrouping: ExecutionForGrouping[] = segmentExecutions.map((e) => ({
        id: e.id,
        side: e.side,
        quantity: e.quantity,
        price: new Decimal(e.price.toString()),
        executedAt: e.executedAt,
      }));

      const groupedTrades = groupExecutionsIntoTrades(forGrouping);
      const executionById = new Map(segmentExecutions.map((e) => [e.id, e]));

      // See order-brokerage.ts for why this attribution is needed (brokerage
      // is charged per ORDER, not per FIFO-matched leg).
      const orderAggregates = aggregateOrders(
        segmentExecutions.map((e) => ({
          brokerOrderId: e.brokerOrderId,
          quantity: e.quantity,
          price: new Decimal(e.price.toString()),
        }))
      );

      // productType is only known once FIFO grouping has classified each
      // trade; an order's fills virtually always land in one trade/day, so
      // the first trade touching an order's execution determines its
      // productType for brokerage purposes.
      const orderProductType = new Map<string, TradeProductType>();
      for (const grouped of groupedTrades) {
        for (const te of grouped.tradeExecutions) {
          const execution = executionById.get(te.executionId)!;
          if (!orderProductType.has(execution.brokerOrderId)) {
            orderProductType.set(execution.brokerOrderId, grouped.productType);
          }
        }
      }

      const orderBrokerage = new Map<string, Decimal>();
      const brokerageFormula = getBrokerageFormula(brokerCode);
      for (const [orderId, agg] of orderAggregates) {
        const productType = orderProductType.get(orderId);
        if (!productType) continue; // order touched no grouped trade — shouldn't happen
        orderBrokerage.set(orderId, brokerageFormula(agg.totalTurnover, productType, chargeSegment));
      }

      for (const grouped of groupedTrades) {
        const legCharges = grouped.tradeExecutions.map((te) => {
          const execution = executionById.get(te.executionId)!;
          const exchange = execution.exchange === "BSE" ? "BSE" : execution.exchange === "MCX" ? "MCX" : "NSE";
          const regulatory = calculateRegulatoryCharges({
            side: execution.side,
            quantity: te.matchedQuantity,
            price: new Decimal(execution.price.toString()),
            productType: grouped.productType,
            exchange,
            segment: chargeSegment,
          });

          const orderAgg = orderAggregates.get(execution.brokerOrderId)!;
          const orderTotalBrokerage = orderBrokerage.get(execution.brokerOrderId) ?? new Decimal(0);
          const legBrokerageShare = attributeLegBrokerage(orderTotalBrokerage, te.matchedQuantity, orderAgg.totalQuantity);

          return composeChargeBreakdown(regulatory, legBrokerageShare);
        });

        const totalCharges = legCharges.reduce((sum, c) => sum.plus(c.totalCharges), new Decimal(0));
        const netPnl = grouped.grossPnl.minus(totalCharges);
        const chargeBreakdown = legCharges.reduce(
          (acc, c) => ({
            turnover: acc.turnover + c.turnover.toNumber(),
            brokerage: acc.brokerage + c.brokerage.toNumber(),
            sttCtt: acc.sttCtt + c.sttCtt.toNumber(),
            exchangeTxnCharge: acc.exchangeTxnCharge + c.exchangeTxnCharge.toNumber(),
            sebiCharges: acc.sebiCharges + c.sebiCharges.toNumber(),
            stampDuty: acc.stampDuty + c.stampDuty.toNumber(),
            gst: acc.gst + c.gst.toNumber(),
          }),
          { turnover: 0, brokerage: 0, sttCtt: 0, exchangeTxnCharge: 0, sebiCharges: 0, stampDuty: 0, gst: 0 }
        );

        const trade = await prisma.trade.create({
          data: {
            userId,
            brokerAccountId,
            instrumentId,
            side: grouped.side,
            productType: grouped.productType,
            status: grouped.status,
            openedAt: grouped.openedAt,
            closedAt: grouped.closedAt,
            quantity: grouped.quantity,
            entryAvgPrice: grouped.entryAvgPrice.toNumber(),
            exitAvgPrice: grouped.exitAvgPrice?.toNumber(),
            grossPnl: grouped.grossPnl.toNumber(),
            totalCharges: totalCharges.toNumber(),
            netPnl: netPnl.toNumber(),
            chargeBreakdown,
            tradeExecutions: {
              create: grouped.tradeExecutions.map((te) => ({
                executionId: te.executionId,
                role: te.role,
                matchedQuantity: te.matchedQuantity,
              })),
            },
          },
        });
        tradesCreated++;

        await evaluateAndScoreTrade(trade.id);
      }
    }
  }

  return tradesCreated;
}
