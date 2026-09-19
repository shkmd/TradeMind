import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { dhanAdapter } from "../csv-parser";

const fixturePath = path.resolve(__dirname, "../../../../../fixtures/dhan-tradebook-sample.csv");

describe("dhanAdapter.parseFile", () => {
  const buffer = readFileSync(fixturePath);
  const rows = dhanAdapter.parseFile(buffer, "csv");

  it("parses every data row, including the malformed one", () => {
    expect(rows).toHaveLength(4);
  });

  it("splits exchangeSegment into exchange + segment", () => {
    const first = rows[0]!;
    expect(first.execution?.exchange).toBe("NSE");
    expect(first.execution?.segment).toBe("EQ");
  });

  it("flags the row with a missing price as invalid", () => {
    const invalid = rows.filter((r) => r.execution === null);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.errors.join(" ")).toMatch(/price/i);
  });

  it("maps BUY/SELL and IST timestamps correctly", () => {
    const sell = rows[1]!;
    expect(sell.execution?.side).toBe("SELL");
    expect(sell.execution?.symbol).toBe("RELIANCE");
    expect(sell.execution?.isin).toBe("INE002A01018");
    expect(sell.execution?.executedAt.toISOString()).toBe(new Date("2024-01-15T14:10:00+05:30").toISOString());
  });
});
