import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { calculateRegulatoryCharges, GST_RATE } from "../regulatory";
import { calculateCharges } from "../multi-broker-equity";

/**
 * Golden reconciliation tests — every expected value below is the broker's
 * OWN reported charge from a real Angel One "Trades and Charges" export
 * (not derived from our formulas), cross-checked against these constants
 * during calibration. All sample rows have Brokerage=0 (the real per-order
 * flat fee lands on a separate zero-quantity row in the source file), so
 * reported GST = 18% x (exchangeTxnCharge + sebiCharges) exactly, matching
 * calculateRegulatoryCharges output directly without needing brokerage.
 */

function gstOnRegulatory(exchangeTxnCharge: Decimal, sebiCharges: Decimal): number {
  return exchangeTxnCharge.plus(sebiCharges).times(GST_RATE).toNumber();
}

describe("F&O regulatory charges — BSE index options (BSXOPT SENSEX)", () => {
  it("SELL: STT 0.1% of premium, BSE exchange-txn rate, no stamp duty", () => {
    const result = calculateRegulatoryCharges({
      side: "SELL",
      quantity: 20,
      price: new Decimal("237.9"),
      productType: "INTRADAY",
      exchange: "BSE",
      segment: "OPTIONS",
    });
    expect(result.turnover.toNumber()).toBe(4758);
    expect(result.sttCtt.toNumber()).toBeCloseTo(4.76, 1);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(1.55, 1);
    expect(result.stampDuty.toNumber()).toBe(0);
    expect(gstOnRegulatory(result.exchangeTxnCharge, result.sebiCharges)).toBeCloseTo(0.28, 1);
  });

  it("SELL: second real row, confirms rate consistency", () => {
    const result = calculateRegulatoryCharges({
      side: "SELL",
      quantity: 20,
      price: new Decimal("111.7"),
      productType: "INTRADAY",
      exchange: "BSE",
      segment: "OPTIONS",
    });
    expect(result.sttCtt.toNumber()).toBeCloseTo(2.23, 1);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(0.73, 1);
  });
});

describe("F&O regulatory charges — NSE index options (OPTIDX)", () => {
  it("BUY: STT zero, stamp duty applies, NSE exchange-txn rate", () => {
    const result = calculateRegulatoryCharges({
      side: "BUY",
      quantity: 30,
      price: new Decimal("274.6"),
      productType: "INTRADAY",
      exchange: "NSE",
      segment: "OPTIONS",
    });
    expect(result.sttCtt.toNumber()).toBe(0);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(2.89, 1);
    expect(result.stampDuty.toNumber()).toBeCloseTo(0.25, 1);
    expect(gstOnRegulatory(result.exchangeTxnCharge, result.sebiCharges)).toBeCloseTo(0.53, 1);
  });

  it("SELL: STT 0.1% of premium applies, stamp duty zero", () => {
    const result = calculateRegulatoryCharges({
      side: "SELL",
      quantity: 60,
      price: new Decimal("48.5"),
      productType: "INTRADAY",
      exchange: "NSE",
      segment: "OPTIONS",
    });
    expect(result.sttCtt.toNumber()).toBeCloseTo(2.91, 1);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(1.02, 1);
    expect(result.stampDuty.toNumber()).toBe(0);
  });

  it("NSE exchange-txn rate is distinct from BSE's (confirms per-exchange calibration)", () => {
    const nse = calculateRegulatoryCharges({
      side: "BUY", quantity: 150, price: new Decimal("114.2"),
      productType: "INTRADAY", exchange: "NSE", segment: "OPTIONS",
    });
    expect(nse.exchangeTxnCharge.toNumber()).toBeCloseTo(6, 0);
    expect(nse.stampDuty.toNumber()).toBeCloseTo(0.51, 1);
  });
});

describe("F&O regulatory charges — MCX commodity options (OPTFUT)", () => {
  it("SELL: commodity options STT is half the equity-index rate (0.05%)", () => {
    const result = calculateRegulatoryCharges({
      side: "SELL",
      quantity: 1250,
      price: new Decimal("13.35"),
      productType: "INTRADAY",
      exchange: "MCX",
      segment: "OPTIONS",
    });
    expect(result.sttCtt.toNumber()).toBeCloseTo(8.34, 1);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(6.98, 1);
  });

  it("BUY: MCX options exchange-txn rate applies, stamp duty at the options rate", () => {
    const result = calculateRegulatoryCharges({
      side: "BUY",
      quantity: 200,
      price: new Decimal("104.5"),
      productType: "INTRADAY",
      exchange: "MCX",
      segment: "OPTIONS",
    });
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(8.74, 1);
    expect(result.stampDuty.toNumber()).toBeCloseTo(0.63, 1);
  });
});

describe("F&O regulatory charges — MCX commodity futures (FUTCOM)", () => {
  it("SELL: futures CTT is 0.01% of turnover, distinct from options rates", () => {
    const result = calculateRegulatoryCharges({
      side: "SELL",
      quantity: 250,
      price: new Decimal("230.1"),
      productType: "INTRADAY",
      exchange: "MCX",
      segment: "FUTURES",
    });
    expect(result.sttCtt.toNumber()).toBeCloseTo(5.75, 1);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(1.21, 1);
  });

  it("BUY: futures stamp duty rate (0.002%) is lower than the options rate (0.003%)", () => {
    const result = calculateRegulatoryCharges({
      side: "BUY",
      quantity: 250,
      price: new Decimal("227.8"),
      productType: "INTRADAY",
      exchange: "MCX",
      segment: "FUTURES",
    });
    expect(result.sttCtt.toNumber()).toBe(0);
    expect(result.exchangeTxnCharge.toNumber()).toBeCloseTo(1.2, 1);
    expect(result.stampDuty.toNumber()).toBeCloseTo(1.14, 1);
  });

  it("second real futures pair (CRUDEOILM) confirms rate consistency", () => {
    const buy = calculateRegulatoryCharges({
      side: "BUY", quantity: 10, price: new Decimal("6029"),
      productType: "INTRADAY", exchange: "MCX", segment: "FUTURES",
    });
    const sell = calculateRegulatoryCharges({
      side: "SELL", quantity: 10, price: new Decimal("6032"),
      productType: "INTRADAY", exchange: "MCX", segment: "FUTURES",
    });
    expect(buy.stampDuty.toNumber()).toBeCloseTo(1.21, 1);
    expect(sell.sttCtt.toNumber()).toBeCloseTo(6.03, 1);
  });
});

describe("calculateRegulatoryCharges — unsupported exchange/segment combos throw", () => {
  it("throws for equity-index futures (NSE/BSE FUTURES) — no verified rate", () => {
    expect(() =>
      calculateRegulatoryCharges({
        side: "SELL", quantity: 50, price: new Decimal(100),
        productType: "INTRADAY", exchange: "NSE", segment: "FUTURES",
      })
    ).toThrow(/no verified exchange transaction charge rate/i);
  });
});

describe("calculateCharges — Angel One F&O brokerage is flat regardless of productType", () => {
  it("flat ₹20/order for options, both productTypes", () => {
    const intraday = calculateCharges("ANGEL_ONE", {
      side: "SELL", quantity: 20, price: new Decimal("237.9"),
      productType: "INTRADAY", exchange: "BSE", segment: "OPTIONS",
    });
    const delivery = calculateCharges("ANGEL_ONE", {
      side: "SELL", quantity: 20, price: new Decimal("237.9"),
      productType: "DELIVERY", exchange: "BSE", segment: "OPTIONS",
    });
    expect(intraday.brokerage.toNumber()).toBe(20);
    expect(delivery.brokerage.toNumber()).toBe(20);
  });
});

describe("calculateCharges — other brokers throw on F&O (defense-in-depth)", () => {
  it("ZERODHA throws rather than silently mis-price an F&O leg", () => {
    expect(() =>
      calculateCharges("ZERODHA", {
        side: "SELL", quantity: 20, price: new Decimal("237.9"),
        productType: "INTRADAY", exchange: "BSE", segment: "OPTIONS",
      })
    ).toThrow(/F&O brokerage is not yet verified/i);
  });
});
