import { describe, it, expect } from "vitest";
import { isLikelyETF } from "../is-etf";

describe("isLikelyETF", () => {
  it("detects the BEES suffix convention", () => {
    expect(isLikelyETF("GOLDBEES")).toBe(true);
    expect(isLikelyETF("ITBEES")).toBe(true);
    expect(isLikelyETF("PHARMABEES")).toBe(true);
  });

  it("detects the IETF suffix convention", () => {
    expect(isLikelyETF("PSUBNKIETF")).toBe(true);
    expect(isLikelyETF("SILVERIETF")).toBe(true);
  });

  it("detects a literal ETF substring", () => {
    expect(isLikelyETF("NIP IND ETF IT")).toBe(true);
    expect(isLikelyETF("ICICIPRAMC - EVIETF")).toBe(true);
  });

  it("detects AMC/AML fund-house-prefixed names", () => {
    expect(isLikelyETF("MIRAEAMC - METAL")).toBe(true);
    expect(isLikelyETF("MOTILALAMC - MOENERGY")).toBe(true);
    expect(isLikelyETF("TATAAML-TATAGOLD")).toBe(true);
  });

  it("does not flag ordinary equity names", () => {
    expect(isLikelyETF("CANARA BANK")).toBe(false);
    expect(isLikelyETF("SUZLON ENERGY LIMITED")).toBe(false);
    expect(isLikelyETF("FEDERALBNK")).toBe(false);
  });
});
