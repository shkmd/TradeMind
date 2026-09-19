import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateZerodhaEquityCharges } from "../zerodha-equity";

// Hand-calculated for quantity=100, price=50 (turnover=5000), NSE.

describe("calculateZerodhaEquityCharges — INTRADAY", () => {
  it("SELL leg: brokerage capped, STT on sell only, stamp duty zero", () => {
    const result = calculateZerodhaEquityCharges({
      side: "SELL",
      quantity: 100,
      price: new Decimal(50),
      productType: "INTRADAY",
      exchange: "NSE",
    });

    expect(result.turnover.toNumber()).toBe(5000);
    expect(result.brokerage.toNumber()).toBe(1.5);
    expect(result.sttCtt.toNumber()).toBe(1.25);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(0.1485, 6);
    expect(result.sebiCharges.toNumber()).toBeCloseTo(0.005, 6);
    expect(result.stampDuty.toNumber()).toBe(0);
    expect(result.gst.toNumber()).toBeCloseTo(0.29763, 5);
    expect(result.totalCharges.toNumber()).toBeCloseTo(3.20113, 5);
  });

  it("BUY leg: STT zero, stamp duty applies", () => {
    const result = calculateZerodhaEquityCharges({
      side: "BUY",
      quantity: 100,
      price: new Decimal(50),
      productType: "INTRADAY",
      exchange: "NSE",
    });

    expect(result.sttCtt.toNumber()).toBe(0);
    expect(result.stampDuty.toNumber()).toBeCloseTo(0.15, 6);
    expect(result.totalCharges.toNumber()).toBeCloseTo(2.10113, 5);
  });

  it("brokerage is capped at ₹20 on large turnover", () => {
    const result = calculateZerodhaEquityCharges({
      side: "BUY",
      quantity: 10000,
      price: new Decimal(500), // turnover = 5,000,000 -> 0.03% = 1500, capped to 20
      productType: "INTRADAY",
      exchange: "NSE",
    });
    expect(result.brokerage.toNumber()).toBe(20);
  });
});

describe("calculateZerodhaEquityCharges — DELIVERY", () => {
  it("BUY leg: zero brokerage, STT + stamp duty apply", () => {
    const result = calculateZerodhaEquityCharges({
      side: "BUY",
      quantity: 100,
      price: new Decimal(50),
      productType: "DELIVERY",
      exchange: "NSE",
    });

    expect(result.brokerage.toNumber()).toBe(0);
    expect(result.sttCtt.toNumber()).toBe(5);
    expect(result.stampDuty.toNumber()).toBeCloseTo(0.75, 6);
    expect(result.totalCharges.toNumber()).toBeCloseTo(5.93113, 5);
  });

  it("SELL leg: STT applies on both legs for delivery, stamp duty zero", () => {
    const result = calculateZerodhaEquityCharges({
      side: "SELL",
      quantity: 100,
      price: new Decimal(50),
      productType: "DELIVERY",
      exchange: "NSE",
    });

    expect(result.sttCtt.toNumber()).toBe(5);
    expect(result.stampDuty.toNumber()).toBe(0);
    expect(result.totalCharges.toNumber()).toBeCloseTo(5.18113, 5);
  });
});

describe("calculateZerodhaEquityCharges — reconciliation invariant", () => {
  it("component charges always sum to totalCharges", () => {
    const cases = [
      { side: "BUY" as const, productType: "INTRADAY" as const },
      { side: "SELL" as const, productType: "INTRADAY" as const },
      { side: "BUY" as const, productType: "DELIVERY" as const },
      { side: "SELL" as const, productType: "DELIVERY" as const },
    ];

    for (const c of cases) {
      const result = calculateZerodhaEquityCharges({
        ...c,
        quantity: 137,
        price: new Decimal("243.65"),
        exchange: "NSE",
      });
      const sum = result.brokerage
        .plus(result.sttCtt)
        .plus(result.exchangeTxnCharge)
        .plus(result.sebiCharges)
        .plus(result.stampDuty)
        .plus(result.gst);
      expect(sum.toNumber()).toBeCloseTo(result.totalCharges.toNumber(), 8);
    }
  });
});
