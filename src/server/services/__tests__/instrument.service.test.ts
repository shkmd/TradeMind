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

  it("matches an AMC-prefixed fund name where the live ticker is a suffix, not a prefix", () => {
    // Real examples: Angel One's CSV names these funds "{AMC} - {ticker}" or
    // "{AMC}-{ticker}", but the live ticker alone never prefixes the string.
    const funds = [
      { symbol: "MIRAEAMC - METAL" },
      { symbol: "TATAAML-TATAGOLD" },
      { symbol: "AONEAMC - AONENIFTY" },
    ];
    expect(matchEquityInstrumentByName(funds, "METAL")?.symbol).toBe("MIRAEAMC - METAL");
    expect(matchEquityInstrumentByName(funds, "TATAGOLD")?.symbol).toBe("TATAAML-TATAGOLD");
    expect(matchEquityInstrumentByName(funds, "AONENIFTY")?.symbol).toBe("AONEAMC - AONENIFTY");
  });

  it("does not use the substring rule for tickers shorter than 4 characters (too easy to false-match)", () => {
    const candidates = [{ symbol: "SOME LONG COMPANY NAME" }];
    expect(matchEquityInstrumentByName(candidates, "ONG")).toBeNull();
  });

  it("bridges an abbreviation ticker with no textual relationship to its name via the NSE reference table", () => {
    // Real examples: none of these tickers are a prefix/suffix of the
    // company name at all — only the reference table's real ticker->name
    // mapping can bridge them.
    const abbreviated = [
      { symbol: "CANARA BANK" },
      { symbol: "POWER FIN CORP LTD." },
      { symbol: "BANK OF MAHARASHTRA" },
      { symbol: "INFOSYS LIMITED" },
    ];
    expect(matchEquityInstrumentByName(abbreviated, "CANBK")?.symbol).toBe("CANARA BANK");
    expect(matchEquityInstrumentByName(abbreviated, "PFC")?.symbol).toBe("POWER FIN CORP LTD.");
    expect(matchEquityInstrumentByName(abbreviated, "MAHABANK")?.symbol).toBe("BANK OF MAHARASHTRA");
    expect(matchEquityInstrumentByName(abbreviated, "INFY")?.symbol).toBe("INFOSYS LIMITED");
  });

  it("still returns null for an abbreviation ticker when its real name isn't among the candidates", () => {
    expect(matchEquityInstrumentByName(csvInstruments, "CANBK")).toBeNull();
  });

  it("prefers a confirmed reference-table match over a false positive from the naive rule", () => {
    // Real example: ticker "MOTHERSON" (Samvardhana Motherson International,
    // per the reference table) is also a literal text-prefix of "MOTHERSON
    // SUMI WRNG" — a different, separately-listed company. Without
    // preferring the reference match, both would match and this would
    // wrongly return null (a false ambiguous result) instead of the one
    // real match.
    const withLookalike = [{ symbol: "SAMVRDHNA MTHRSN INT" }, { symbol: "MOTHERSON SUMI WRNG" }];
    expect(matchEquityInstrumentByName(withLookalike, "MOTHERSON")?.symbol).toBe("SAMVRDHNA MTHRSN INT");
  });

  it("falls back to the naive rule when the ticker has no reference entry at all", () => {
    const funds = [{ symbol: "SOME FUND HOUSE - MADEUPTICKER" }];
    expect(matchEquityInstrumentByName(funds, "MADEUPTICKER")?.symbol).toBe("SOME FUND HOUSE - MADEUPTICKER");
  });

  it("uses a verified manual override to disambiguate METAL from the unrelated METALIETF", () => {
    // Real example: Zerodha's own reference name for METAL ("MIRAE ASSET
    // NIFTY METAL ETF") doesn't textually relate to Angel One's CSV name
    // ("MIRAEAMC - METAL") at all, and the naive substring rule alone can't
    // tell ticker "METAL" apart from the unrelated "ICICIPRAMC - METALIETF"
    // (a different, separately-held fund whose CSV name also contains
    // "METAL") — both match, so the naive rule alone reports ambiguous.
    // The manual override resolves it to the one real match.
    const funds = [{ symbol: "MIRAEAMC - METAL" }, { symbol: "ICICIPRAMC - METALIETF" }];
    expect(matchEquityInstrumentByName(funds, "METAL")?.symbol).toBe("MIRAEAMC - METAL");
    expect(matchEquityInstrumentByName(funds, "METALIETF")?.symbol).toBe("ICICIPRAMC - METALIETF");
  });

  it("resolves the other verified manual overrides (MON100, ITBEES, PSUBNKIETF, SILVERIETF, PHARMABEES)", () => {
    const funds = [
      { symbol: "MOTILAL OS NASDAQ100" },
      { symbol: "NIP IND ETF IT" },
      { symbol: "ICICIPRAMC - PSUBANK" },
      { symbol: "ICICIPRAMC - ICICISILVE" },
      { symbol: "NIPPONAMC - NETFPHARMA" },
    ];
    expect(matchEquityInstrumentByName(funds, "MON100")?.symbol).toBe("MOTILAL OS NASDAQ100");
    expect(matchEquityInstrumentByName(funds, "ITBEES")?.symbol).toBe("NIP IND ETF IT");
    expect(matchEquityInstrumentByName(funds, "PSUBNKIETF")?.symbol).toBe("ICICIPRAMC - PSUBANK");
    expect(matchEquityInstrumentByName(funds, "SILVERIETF")?.symbol).toBe("ICICIPRAMC - ICICISILVE");
    expect(matchEquityInstrumentByName(funds, "PHARMABEES")?.symbol).toBe("NIPPONAMC - NETFPHARMA");
  });
});
