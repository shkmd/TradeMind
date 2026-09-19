import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { upstoxAdapter } from "../csv-parser";

const fixturePath = path.resolve(__dirname, "../../../../../fixtures/upstox-trade-history-sample.csv");

describe("upstoxAdapter.parseFile", () => {
  const buffer = readFileSync(fixturePath);
  const rows = upstoxAdapter.parseFile(buffer, "csv");

  it("parses every data row, including the malformed one", () => {
    expect(rows).toHaveLength(4);
  });

  it("flags the row with zero price as invalid", () => {
    const invalid = rows.filter((r) => r.execution === null);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.errors.join(" ")).toMatch(/price/i);
  });

  it("falls back to midnight IST when trade_date has no time component", () => {
    const dateOnly = rows[2]!;
    expect(dateOnly.execution).not.toBeNull();
    expect(dateOnly.execution?.executedAt.toISOString()).toBe(new Date("2024-01-16T00:00:00+05:30").toISOString());
  });

  it("falls back to trade_id as the order id when no separate order column matches", () => {
    const first = rows[0]!;
    // Fixture DOES have a distinct order_id column, so it should be used as-is.
    expect(first.execution?.brokerOrderId).toBe("UO100001");

    // Without an order-id-like column at all, brokerOrderId should fall
    // back to trade_id rather than failing validation.
    const noOrderColumnCsv =
      "symbol,exchange,segment,transaction_type,quantity,price,trade_id,trade_date\n" +
      "SBIN,NSE,EQ,BUY,10,600,UT999,2024-01-20 10:00:00\n";
    const fallbackRows = upstoxAdapter.parseFile(Buffer.from(noOrderColumnCsv), "csv");
    expect(fallbackRows[0]!.execution?.brokerOrderId).toBe("UT999");
  });

  it("maps BUY/SELL, symbol and ISIN correctly", () => {
    const sell = rows[1]!;
    expect(sell.execution?.side).toBe("SELL");
    expect(sell.execution?.symbol).toBe("RELIANCE");
    expect(sell.execution?.isin).toBe("INE002A01018");
  });
});
