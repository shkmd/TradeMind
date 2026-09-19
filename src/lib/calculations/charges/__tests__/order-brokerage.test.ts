import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { aggregateOrders, attributeLegBrokerage } from "../order-brokerage";

describe("aggregateOrders", () => {
  it("sums quantity and turnover across multiple fills of the same order", () => {
    const aggregates = aggregateOrders([
      { brokerOrderId: "O1", quantity: 20, price: new Decimal(100) },
      { brokerOrderId: "O1", quantity: 30, price: new Decimal(105) },
    ]);
    const o1 = aggregates.get("O1")!;
    expect(o1.totalQuantity).toBe(50);
    expect(o1.totalTurnover.toNumber()).toBe(20 * 100 + 30 * 105);
  });

  it("keeps different orders separate", () => {
    const aggregates = aggregateOrders([
      { brokerOrderId: "O1", quantity: 10, price: new Decimal(50) },
      { brokerOrderId: "O2", quantity: 5, price: new Decimal(200) },
    ]);
    expect(aggregates.size).toBe(2);
    expect(aggregates.get("O1")!.totalQuantity).toBe(10);
    expect(aggregates.get("O2")!.totalQuantity).toBe(5);
  });
});

describe("attributeLegBrokerage", () => {
  it("gives a single leg the full order brokerage when it's the only leg", () => {
    const share = attributeLegBrokerage(new Decimal(20), 100, 100);
    expect(share.toNumber()).toBe(20);
  });

  it("splits proportionally across multiple legs, summing back to the order total", () => {
    const orderBrokerage = new Decimal(20);
    const totalQuantity = 100;
    const leg1 = attributeLegBrokerage(orderBrokerage, 30, totalQuantity);
    const leg2 = attributeLegBrokerage(orderBrokerage, 70, totalQuantity);
    expect(leg1.plus(leg2).toNumber()).toBeCloseTo(20, 10);
    expect(leg1.toNumber()).toBeCloseTo(6, 10);
    expect(leg2.toNumber()).toBeCloseTo(14, 10);
  });

  it("does NOT charge the full flat fee to every leg (the bug this fixes)", () => {
    // Before the fix: 3 legs of one ₹20 order would each independently get
    // ₹20 (₹60 total, 3x overcount). After: they split the real ₹20.
    const orderBrokerage = new Decimal(20);
    const totalQuantity = 90;
    const legs = [30, 30, 30].map((qty) => attributeLegBrokerage(orderBrokerage, qty, totalQuantity));
    const sum = legs.reduce((acc, l) => acc.plus(l), new Decimal(0));
    expect(sum.toNumber()).toBeCloseTo(20, 10);
    expect(sum.toNumber()).not.toBeCloseTo(60, 1);
  });

  it("returns zero when the order has no quantity (defensive, shouldn't happen)", () => {
    const share = attributeLegBrokerage(new Decimal(20), 10, 0);
    expect(share.toNumber()).toBe(0);
  });
});
