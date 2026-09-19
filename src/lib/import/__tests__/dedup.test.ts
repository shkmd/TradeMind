import { describe, it, expect } from "vitest";
import { computeFingerprint } from "../dedup";

const baseRow = {
  brokerAccountId: "acct_1",
  exchange: "NSE",
  brokerTradeId: "T1",
  brokerOrderId: "O1",
  executedAt: new Date("2024-01-15T09:20:00+05:30"),
  symbol: "RELIANCE",
  side: "BUY",
  quantity: 10,
  price: 2500,
};

describe("computeFingerprint", () => {
  it("produces the same fingerprint for an identical row (duplicate detection)", () => {
    const a = computeFingerprint(baseRow);
    const b = computeFingerprint({ ...baseRow });
    expect(a).toBe(b);
  });

  it("produces a different fingerprint when the price differs, even with the same trade/order id", () => {
    const a = computeFingerprint(baseRow);
    const b = computeFingerprint({ ...baseRow, price: 2501 });
    expect(a).not.toBe(b);
  });

  it("produces a different fingerprint for a different broker account (same trade id reused across accounts)", () => {
    const a = computeFingerprint(baseRow);
    const b = computeFingerprint({ ...baseRow, brokerAccountId: "acct_2" });
    expect(a).not.toBe(b);
  });

  it("produces a different fingerprint when quantity differs", () => {
    const a = computeFingerprint(baseRow);
    const b = computeFingerprint({ ...baseRow, quantity: 11 });
    expect(a).not.toBe(b);
  });
});
