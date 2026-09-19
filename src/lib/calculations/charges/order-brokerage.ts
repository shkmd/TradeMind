import Decimal from "decimal.js";

/**
 * Brokers charge brokerage once per ORDER (often a flat/capped fee), not
 * once per FIFO-matched trade leg. An order's fills can be split across
 * multiple legs — partial fills, or one fill that both closes one trade and
 * opens another — so charging each leg its own brokerage independently
 * overcounts substantially, especially for flat-fee F&O brokerage (confirmed
 * against a real account: 4,493 orders but 7,729 FIFO-matched legs, inflating
 * total computed brokerage by ~1.7x). These two pure functions aggregate
 * executions to the order level, then attribute each order's total brokerage
 * back to its legs proportional to matched quantity, so the shares sum
 * exactly to what the order was actually charged.
 */

export interface OrderExecutionInput {
  brokerOrderId: string;
  quantity: number;
  price: Decimal;
}

export interface OrderAggregate {
  totalQuantity: number;
  totalTurnover: Decimal;
}

export function aggregateOrders(executions: OrderExecutionInput[]): Map<string, OrderAggregate> {
  const aggregates = new Map<string, OrderAggregate>();
  for (const e of executions) {
    const agg = aggregates.get(e.brokerOrderId) ?? { totalQuantity: 0, totalTurnover: new Decimal(0) };
    agg.totalQuantity += e.quantity;
    agg.totalTurnover = agg.totalTurnover.plus(e.price.times(e.quantity));
    aggregates.set(e.brokerOrderId, agg);
  }
  return aggregates;
}

export function attributeLegBrokerage(orderTotalBrokerage: Decimal, legQuantity: number, orderTotalQuantity: number): Decimal {
  if (orderTotalQuantity <= 0) return new Decimal(0);
  return orderTotalBrokerage.times(legQuantity).dividedBy(orderTotalQuantity);
}
