import { describe, it, expect } from "vitest";
import { parseAngelContract } from "../contract-parser";

describe("parseAngelContract — BSXOPT (BSE index options)", () => {
  it("parses a real BSE SENSEX option, stripping the (BT) suffix", () => {
    const result = parseAngelContract("BSXOPT SENSEX Apr  1 2025 78200.00 CE (BT)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("SENSEX");
    expect(result.contract.strikePrice).toBe(78200);
    expect(result.contract.optionType).toBe("CE");
    expect(result.contract.segment).toBe("OPTIONS");
    expect(result.contract.expiryDate.toISOString()).toBe(new Date("2025-04-01T00:00:00+05:30").toISOString());
  });

  it("tolerates the double space between month and day", () => {
    const result = parseAngelContract("BSXOPT SENSEX Apr  1 2025 78300.00 CE (BT)");
    expect(result.ok).toBe(true);
  });
});

describe("parseAngelContract — OPTIDX (NSE index options)", () => {
  it("parses a real NSE NIFTY put option", () => {
    const result = parseAngelContract("OPTIDX NIFTY Mar 27 2025 23500.00 PE (BT)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("NIFTY");
    expect(result.contract.strikePrice).toBe(23500);
    expect(result.contract.optionType).toBe("PE");
  });

  it("parses a real NSE BANKNIFTY call option without the suffix", () => {
    const result = parseAngelContract("OPTIDX BANKNIFTY Mar 27 2025 52000.00 CE");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("BANKNIFTY");
  });
});

describe("parseAngelContract — BKXOPT (BSE BANKEX index options)", () => {
  it("parses a real BANKEX option", () => {
    const result = parseAngelContract("BKXOPT BANKEX Jan 28 2025 55200.00 CE (BT)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("BANKEX");
    expect(result.contract.strikePrice).toBe(55200);
  });
});

describe("parseAngelContract — OPTSTK (NSE individual-stock options)", () => {
  it("parses a real RELIANCE stock option", () => {
    const result = parseAngelContract("OPTSTK RELIANCE Mar 27 2025 1310.00 CE (BT)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("RELIANCE");
    expect(result.contract.optionType).toBe("CE");
  });

  it("parses an underlying containing a special character (M&M)", () => {
    const result = parseAngelContract("OPTSTK M&M Jan 30 2025 2900.00 PE (BT)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("M&M");
  });
});

describe("parseAngelContract — OPTFUT (MCX commodity options)", () => {
  it("parses a real crude oil option with the compact date format", () => {
    const result = parseAngelContract("OPTFUT CRUDEOIL 16APR25 6100.00 CE");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("CRUDEOIL");
    expect(result.contract.strikePrice).toBe(6100);
    expect(result.contract.optionType).toBe("CE");
    expect(result.contract.expiryDate.toISOString()).toBe(new Date("2025-04-16T00:00:00+05:30").toISOString());
  });

  it("parses a real natural gas put option", () => {
    const result = parseAngelContract("OPTFUT NATURALGAS 23APR25 320.00 PE");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("NATURALGAS");
  });
});

describe("parseAngelContract — FUTCOM (MCX commodity futures)", () => {
  it("parses a real futures contract with no strike or option type", () => {
    const result = parseAngelContract("FUTCOM NATGASMINI 25NOV24");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("NATGASMINI");
    expect(result.contract.strikePrice).toBeNull();
    expect(result.contract.optionType).toBeNull();
    expect(result.contract.segment).toBe("FUTURES");
    expect(result.contract.expiryDate.toISOString()).toBe(new Date("2024-11-25T00:00:00+05:30").toISOString());
  });

  it("parses a real crude oil mini futures contract", () => {
    const result = parseAngelContract("FUTCOM CRUDEOILM 19NOV24");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contract.underlying).toBe("CRUDEOILM");
  });
});

describe("parseAngelContract — rejects malformed or unrecognized contracts", () => {
  it("rejects an unrecognized prefix", () => {
    const result = parseAngelContract("FUTIDX NIFTY 27MAR25");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toMatch(/unrecognized F&O contract format/i);
  });

  it("rejects an OPTIDX contract missing the CE/PE token", () => {
    const result = parseAngelContract("OPTIDX NIFTY Mar 27 2025 23500.00 XX");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toMatch(/CE or PE/i);
  });

  it("rejects a FUTCOM contract with a stray CE/PE token", () => {
    const result = parseAngelContract("FUTCOM NATGASMINI 25NOV24 CE");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toMatch(/futures and shouldn't have a trailing CE\/PE/i);
  });

  it("rejects an unparseable strike price", () => {
    const result = parseAngelContract("OPTIDX NIFTY Mar 27 2025 ABC CE");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toMatch(/strike price/i);
  });

  it("rejects an unparseable expiry date", () => {
    const result = parseAngelContract("OPTIDX NIFTY Foo 27 2025 23500.00 CE");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.join(" ")).toMatch(/expiry date/i);
  });

  it("rejects an empty string", () => {
    const result = parseAngelContract("   ");
    expect(result.ok).toBe(false);
  });
});
