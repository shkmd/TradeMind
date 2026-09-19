import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { kotakAdapter } from "../csv-parser";

const fixturePath = path.resolve(__dirname, "../../../../../fixtures/kotak-trade-report-sample.csv");

describe("kotakAdapter.parseFile", () => {
  const buffer = readFileSync(fixturePath);
  const rows = kotakAdapter.parseFile(buffer, "csv");

  it("parses every data row, including the malformed one", () => {
    expect(rows).toHaveLength(4);
  });

  it("parses Kotak's DD-Mon-YYYY date format combined with a separate time column", () => {
    const first = rows[0]!;
    expect(first.execution?.executedAt.toISOString()).toBe(new Date("2025-01-15T09:20:05+05:30").toISOString());
  });

  it("splits exSeg into exchange + segment", () => {
    const first = rows[0]!;
    expect(first.execution?.exchange).toBe("NSE");
    expect(first.execution?.segment).toBe("EQ");
  });

  it("maps single-letter B/S transaction types to BUY/SELL", () => {
    expect(rows[0]!.execution?.side).toBe("BUY");
    expect(rows[1]!.execution?.side).toBe("SELL");
  });

  it("flags the row with a negative price as invalid", () => {
    const invalid = rows.filter((r) => r.execution === null);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.errors.join(" ")).toMatch(/price/i);
  });
});
