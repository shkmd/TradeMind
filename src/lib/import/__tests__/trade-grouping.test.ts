import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { groupExecutionsIntoTrades, type ExecutionForGrouping } from "../trade-grouping";

function exec(
  id: string,
  side: "BUY" | "SELL",
  quantity: number,
  price: number,
  executedAt: string
): ExecutionForGrouping {
  return { id, side, quantity, price: new Decimal(price), executedAt: new Date(executedAt) };
}

describe("groupExecutionsIntoTrades", () => {
  it("matches a same-day round trip as one CLOSED INTRADAY trade", () => {
    const trades = groupExecutionsIntoTrades([
      exec("e1", "BUY", 100, 500, "2024-01-15T09:20:00+05:30"),
      exec("e2", "SELL", 100, 510, "2024-01-15T14:00:00+05:30"),
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.status).toBe("CLOSED");
    expect(trades[0]!.productType).toBe("INTRADAY");
    expect(trades[0]!.grossPnl.toNumber()).toBe(1000);
  });

  it("FIFO-matches a sell that spans two separate buy lots at different prices", () => {
    const trades = groupExecutionsIntoTrades([
      exec("e1", "BUY", 50, 100, "2024-01-15T09:20:00+05:30"),
      exec("e2", "BUY", 50, 110, "2024-01-15T09:25:00+05:30"),
      exec("e3", "SELL", 100, 120, "2024-01-15T09:30:00+05:30"),
    ]);

    expect(trades).toHaveLength(1);
    const trade = trades[0]!;
    expect(trade.quantity).toBe(100);
    expect(trade.entryAvgPrice.toNumber()).toBe(105); // (50*100 + 50*110) / 100
    expect(trade.exitAvgPrice?.toNumber()).toBe(120);
    // Lot 1: (120-100)*50 = 1000, Lot 2: (120-110)*50 = 500
    expect(trade.grossPnl.toNumber()).toBe(1500);
    expect(trade.status).toBe("CLOSED");

    const entryExecutionIds = trade.tradeExecutions.filter((t) => t.role === "ENTRY").map((t) => t.executionId);
    expect(entryExecutionIds.sort()).toEqual(["e1", "e2"]);
    const exit = trade.tradeExecutions.find((t) => t.role === "EXIT");
    expect(exit?.matchedQuantity).toBe(100);
  });

  it("classifies a position still open at end-of-data as DELIVERY, not INTRADAY", () => {
    const trades = groupExecutionsIntoTrades([exec("e1", "BUY", 100, 500, "2024-01-15T09:20:00+05:30")]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.status).toBe("OPEN");
    expect(trades[0]!.productType).toBe("DELIVERY");
    expect(trades[0]!.exitAvgPrice).toBeNull();
    expect(trades[0]!.grossPnl.toNumber()).toBe(0);
  });

  it("classifies a multi-day round trip as DELIVERY even though it fully closed", () => {
    const trades = groupExecutionsIntoTrades([
      exec("e1", "BUY", 100, 500, "2024-01-15T09:20:00+05:30"),
      exec("e2", "SELL", 100, 520, "2024-01-17T10:00:00+05:30"),
    ]);

    expect(trades[0]!.status).toBe("CLOSED");
    expect(trades[0]!.productType).toBe("DELIVERY");
  });

  it("flips direction when an exit exceeds the open position, creating a second trade", () => {
    const trades = groupExecutionsIntoTrades([
      exec("e1", "BUY", 50, 100, "2024-01-15T09:20:00+05:30"),
      exec("e2", "SELL", 80, 110, "2024-01-15T09:30:00+05:30"),
    ]);

    expect(trades).toHaveLength(2);

    const [closedTrade, openTrade] = trades;
    expect(closedTrade!.status).toBe("CLOSED");
    expect(closedTrade!.side).toBe("BUY");
    expect(closedTrade!.quantity).toBe(50);
    expect(closedTrade!.grossPnl.toNumber()).toBe(500); // (110-100)*50

    expect(openTrade!.status).toBe("OPEN");
    expect(openTrade!.side).toBe("SELL");
    expect(openTrade!.quantity).toBe(30);
    expect(openTrade!.entryAvgPrice.toNumber()).toBe(110);
  });

  it("marks a position reduced but not fully closed as PARTIALLY_CLOSED", () => {
    const trades = groupExecutionsIntoTrades([
      exec("e1", "BUY", 100, 500, "2024-01-15T09:20:00+05:30"),
      exec("e2", "SELL", 40, 510, "2024-01-15T10:00:00+05:30"),
    ]);

    expect(trades).toHaveLength(1);
    expect(trades[0]!.status).toBe("PARTIALLY_CLOSED");
    expect(trades[0]!.productType).toBe("DELIVERY");
    expect(trades[0]!.grossPnl.toNumber()).toBe(400); // (510-500)*40
  });
});
