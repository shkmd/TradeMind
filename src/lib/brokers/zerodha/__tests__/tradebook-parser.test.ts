import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { zerodhaAdapter } from "../tradebook-parser";

const fixturePath = path.resolve(__dirname, "../../../../../fixtures/zerodha-tradebook-sample.csv");

describe("zerodhaAdapter.parseFile (CSV)", () => {
  const buffer = readFileSync(fixturePath);
  const rows = zerodhaAdapter.parseFile(buffer, "csv");

  it("parses every data row, including malformed ones", () => {
    expect(rows).toHaveLength(26);
  });

  it("successfully parses well-formed rows into canonical executions", () => {
    const valid = rows.filter((r) => r.execution !== null);
    expect(valid).toHaveLength(25);
  });

  it("flags the row with a missing price as invalid, with a reason", () => {
    const invalid = rows.filter((r) => r.execution === null);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.errors.join(" ")).toMatch(/price/i);
  });

  it("correctly maps the first RELIANCE buy row", () => {
    const first = rows[0]!;
    expect(first.execution).not.toBeNull();
    expect(first.execution?.symbol).toBe("RELIANCE");
    expect(first.execution?.isin).toBe("INE002A01018");
    expect(first.execution?.side).toBe("BUY");
    expect(first.execution?.quantity).toBe(50);
    expect(first.execution?.price).toBe(2450);
    expect(first.execution?.brokerTradeId).toBe("T100001");
    expect(first.execution?.exchange).toBe("NSE");
    expect(first.execution?.executedAt.toISOString()).toBe(new Date("2024-01-15T09:20:05+05:30").toISOString());
  });

  it("normalizes trade_type case (lowercase buy/sell in the fixture)", () => {
    const sellRow = rows.find((r) => r.execution?.brokerTradeId === "T100003");
    expect(sellRow?.execution?.side).toBe("SELL");
  });
});
