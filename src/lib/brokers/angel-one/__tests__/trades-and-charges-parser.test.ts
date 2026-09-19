import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { angelOneAdapter } from "../trades-and-charges-parser";

const fixturePath = path.resolve(__dirname, "../../../../../fixtures/angel-one-trades-and-charges-sample.xlsx");

describe("angelOneAdapter.parseFile", () => {
  const buffer = readFileSync(fixturePath);
  const rows = angelOneAdapter.parseFile(buffer, "xlsx");

  it("skips the metadata block and parses every data row under the real header", () => {
    expect(rows).toHaveLength(10);
  });

  it("reads Buy Price for a BUY row and Sell Price for a SELL row", () => {
    expect(rows[0]!.execution?.side).toBe("BUY");
    expect(rows[0]!.execution?.price).toBe(2450);
    expect(rows[1]!.execution?.side).toBe("SELL");
    expect(rows[1]!.execution?.price).toBe(2465.75);
  });

  it("parses Angel One's M/D/YY date format as IST", () => {
    expect(rows[0]!.execution?.executedAt.toISOString()).toBe(new Date("2024-01-15T00:00:00+05:30").toISOString());
  });

  it("falls back to the order id when trade id is blank", () => {
    const row = rows[2]!;
    expect(row.execution?.brokerTradeId).toBe("1300000004517535");
  });

  it("parses a BSE index option (BSXOPT) F&O row and populates derivative fields", () => {
    const row = rows[3]!;
    expect(row.execution).not.toBeNull();
    expect(row.execution?.derivative?.underlying).toBe("SENSEX");
    expect(row.execution?.derivative?.optionType).toBe("CE");
    expect(row.execution?.derivative?.segment).toBe("OPTIONS");
  });

  it("parses an NSE index option (OPTIDX) F&O row", () => {
    const row = rows[4]!;
    expect(row.execution?.derivative?.underlying).toBe("NIFTY");
  });

  it("parses an MCX commodity option (OPTFUT) F&O row", () => {
    const row = rows[5]!;
    expect(row.execution?.derivative?.underlying).toBe("CRUDEOIL");
    expect(row.execution?.derivative?.segment).toBe("OPTIONS");
  });

  it("parses an MCX commodity futures (FUTCOM) row with no strike/option-type", () => {
    const row = rows[6]!;
    expect(row.execution?.derivative?.underlying).toBe("NATGASMINI");
    expect(row.execution?.derivative?.segment).toBe("FUTURES");
    expect(row.execution?.derivative?.strikePrice).toBeNull();
  });

  it("rejects an unrecognized F&O contract format with a clear reason, not silently", () => {
    const row = rows[7]!;
    expect(row.execution).toBeNull();
    expect(row.errors.join(" ")).toMatch(/unrecognized F&O contract format/i);
  });

  it("flags the zero-quantity garbage row as invalid", () => {
    const garbageRow = rows[8]!;
    expect(garbageRow.execution).toBeNull();
  });

  it("parses the remaining valid equity row", () => {
    const tcsRow = rows[9]!;
    expect(tcsRow.execution?.symbol).toBe("TCS");
    expect(tcsRow.execution?.side).toBe("BUY");
    expect(tcsRow.execution?.derivative).toBeNull();
  });
});
