import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeLotPnl, sumGrossPnl, computeNetPnl } from "../pnl";

describe("computeLotPnl", () => {
  it("computes profit for a long (BUY entry) round trip", () => {
    const pnl = computeLotPnl(new Decimal(100), new Decimal(110), new Decimal(50), "BUY");
    expect(pnl.toNumber()).toBe(500);
  });

  it("computes loss for a long round trip", () => {
    const pnl = computeLotPnl(new Decimal(100), new Decimal(90), new Decimal(50), "BUY");
    expect(pnl.toNumber()).toBe(-500);
  });

  it("computes profit for a short (SELL entry) round trip", () => {
    // Short at 100, cover at 90 -> profit
    const pnl = computeLotPnl(new Decimal(100), new Decimal(90), new Decimal(50), "SELL");
    expect(pnl.toNumber()).toBe(500);
  });

  it("computes loss for a short round trip", () => {
    const pnl = computeLotPnl(new Decimal(100), new Decimal(110), new Decimal(50), "SELL");
    expect(pnl.toNumber()).toBe(-500);
  });
});

describe("sumGrossPnl / computeNetPnl", () => {
  it("sums multiple partial-close lots and applies charges", () => {
    const lots = [new Decimal(500), new Decimal(-100), new Decimal(200)];
    const gross = sumGrossPnl(lots);
    expect(gross.toNumber()).toBe(600);

    const net = computeNetPnl(gross, new Decimal(45.5));
    expect(net.toNumber()).toBe(554.5);
  });
});
