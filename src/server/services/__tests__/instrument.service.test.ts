import { describe, it, expect } from "vitest";
import { buildDerivativeInstrumentFields, matchEquityInstrumentByName } from "../instrument.service";
import { parseAngelContract } from "@/lib/brokers/angel-one/contract-parser";

function parse(raw: string) {
  const result = parseAngelContract(raw);
  if (!result.ok) throw new Error(`Expected valid contract: ${result.reasons.join("; ")}`);
  return result.contract;
}

describe("buildDerivativeInstrumentFields — options", () => {
  it("builds a canonical symbol with no nullable components", () => {
    const fields = buildDerivativeInstrumentFields(parse("BSXOPT SENSEX Apr  1 2025 78200.00 CE (BT)"));
    expect(fields.symbol).toBe("SENSEX-20250401-78200.00-CE");
    expect(fields.segment).toBe("OPTIONS");
    expect(fields.underlying).toBe("SENSEX");
    expect(fields.strikePrice).toBe(78200);
    expect(fields.optionType).toBe("CE");
  });

  it("is deterministic — same contract parsed twice yields the same symbol", () => {
    const a = buildDerivativeInstrumentFields(parse("OPTIDX NIFTY Mar 27 2025 23600.00 CE (BT)"));
    const b = buildDerivativeInstrumentFields(parse("OPTIDX NIFTY Mar 27 2025 23600.00 CE (BT)"));
    expect(a.symbol).toBe(b.symbol);
  });

  it("adjacent strikes on the same underlying/expiry do not collide", () => {
    const a = buildDerivativeInstrumentFields(parse("OPTIDX NIFTY Mar 27 2025 23600.00 CE (BT)"));
    const b = buildDerivativeInstrumentFields(parse("OPTIDX NIFTY Mar 27 2025 23650.00 CE (BT)"));
    expect(a.symbol).not.toBe(b.symbol);
  });

  it("CE and PE on the same strike/expiry do not collide", () => {
    const ce = buildDerivativeInstrumentFields(parse("OPTIDX NIFTY Mar 27 2025 23500.00 CE (BT)"));
    const pe = buildDerivativeInstrumentFields(parse("OPTIDX NIFTY Mar 27 2025 23500.00 PE (BT)"));
    expect(ce.symbol).not.toBe(pe.symbol);
  });
});

describe("buildDerivativeInstrumentFields — futures", () => {
  it("builds a canonical symbol with no strike/option-type components", () => {
    const fields = buildDerivativeInstrumentFields(parse("FUTCOM NATGASMINI 25NOV24"));
    expect(fields.symbol).toBe("NATGASMINI-20241125-FUT");
    expect(fields.segment).toBe("FUTURES");
    expect(fields.strikePrice).toBeNull();
    expect(fields.optionType).toBeNull();
  });

  it("different expiries on the same underlying do not collide", () => {
    const a = buildDerivativeInstrumentFields(parse("FUTCOM CRUDEOILM 19NOV24"));
    const b = buildDerivativeInstrumentFields(parse("FUTCOM CRUDEOILM 17DEC24"));
    expect(a.symbol).not.toBe(b.symbol);
  });
});

describe("matchEquityInstrumentByName", () => {
  // Real examples: Angel One's CSV export names equity rows by full company
  // display name, its live SmartAPI returns the bare NSE trading symbol.
  const csvInstruments = [
    { symbol: "WIPRO LTD" },
    { symbol: "IDFC FIRST BANK LIMITED" },
    { symbol: "SJVN LTD" },
    { symbol: "SUZLON ENERGY LIMITED" },
    { symbol: "CANARA ROBECO AMC LIMITED" },
  ];

  it("matches a bare live trading symbol to its CSV-imported full company name", () => {
    expect(matchEquityInstrumentByName(csvInstruments, "WIPRO")?.symbol).toBe("WIPRO LTD");
    expect(matchEquityInstrumentByName(csvInstruments, "SJVN")?.symbol).toBe("SJVN LTD");
    expect(matchEquityInstrumentByName(csvInstruments, "SUZLON")?.symbol).toBe("SUZLON ENERGY LIMITED");
  });

  it("matches a truncated-at-10-chars NSE symbol via the prefix relationship", () => {
    // NSE symbols are capped at 10 characters — IDFCFIRSTB is a prefix of
    // the normalized full name IDFCFIRSTBANK, not an exact match.
    expect(matchEquityInstrumentByName(csvInstruments, "IDFCFIRSTB")?.symbol).toBe("IDFC FIRST BANK LIMITED");
  });

  it("returns null (never guesses) when nothing matches", () => {
    expect(matchEquityInstrumentByName(csvInstruments, "RELIANCE")).toBeNull();
  });

  it("returns null (never guesses) when the live symbol is ambiguous between two real, distinct candidates", () => {
    const ambiguous = [{ symbol: "TATA MOTORS LTD" }, { symbol: "TATA STEEL LIMITED" }];
    // A naive "starts with TATA" match would hit both — must not pick either.
    expect(matchEquityInstrumentByName(ambiguous, "TATA")).toBeNull();
  });
});
