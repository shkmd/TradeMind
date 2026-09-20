import { describe, it, expect } from "vitest";
import { consolidateByIsin, type ConsolidatableHolding } from "../holdings-consolidation";

function holding(overrides: Partial<ConsolidatableHolding> & { id: string }): ConsolidatableHolding {
  return { isin: null, quantity: 0, avgCostPrice: 0, currentPrice: null, ...overrides };
}

describe("consolidateByIsin", () => {
  it("passes a single-leg holding through unchanged (group of 1)", () => {
    const groups = consolidateByIsin([
      holding({ id: "a", isin: "INE001A01001", quantity: 10, avgCostPrice: 100, currentPrice: 120 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.legs).toHaveLength(1);
    expect(groups[0]!.totalQuantity).toBe(10);
    expect(groups[0]!.weightedAvgCost).toBe(100);
    expect(groups[0]!.currentValue).toBe(1200);
    expect(groups[0]!.unrealised).toBe(200);
    expect(groups[0]!.unrealisedPct).toBeCloseTo(20);
  });

  it("computes the correct weighted average cost across two same-ISIN legs", () => {
    // leg A: 60 units @ 100, leg B: 40 units @ 130 -> weighted avg = (6000+5200)/100 = 112
    const groups = consolidateByIsin([
      holding({ id: "a", isin: "INE001A01001", quantity: 60, avgCostPrice: 100, currentPrice: 150 }),
      holding({ id: "b", isin: "INE001A01001", quantity: 40, avgCostPrice: 130, currentPrice: 150 }),
    ]);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.legs).toHaveLength(2);
    expect(group.totalQuantity).toBe(100);
    expect(group.weightedAvgCost).toBe(112);
    expect(group.currentValue).toBe(15000);
    expect(group.unrealised).toBe(3800); // 15000 - (6000+5200)
  });

  it("excludes an unpriced leg from value/gain but still counts its quantity", () => {
    const groups = consolidateByIsin([
      holding({ id: "a", isin: "INE002A01001", quantity: 10, avgCostPrice: 100, currentPrice: 120 }),
      holding({ id: "b", isin: "INE002A01001", quantity: 5, avgCostPrice: 90, currentPrice: null }),
    ]);
    const group = groups[0]!;
    expect(group.totalQuantity).toBe(15); // both legs counted
    expect(group.currentValue).toBe(1200); // only the priced leg
    expect(group.unrealised).toBe(200); // 1200 - 1000, unpriced leg excluded from both sides
  });

  it("never merges two different holdings that both lack an ISIN", () => {
    const groups = consolidateByIsin([
      holding({ id: "a", isin: null, quantity: 10, avgCostPrice: 100 }),
      holding({ id: "b", isin: null, quantity: 5, avgCostPrice: 200 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.legs.length === 1)).toBe(true);
  });

  it("groups real-ISIN legs together while leaving null-ISIN holdings standalone", () => {
    const groups = consolidateByIsin([
      holding({ id: "a", isin: "INE003A01001", quantity: 10, avgCostPrice: 50, currentPrice: 60 }),
      holding({ id: "b", isin: "INE003A01001", quantity: 20, avgCostPrice: 55, currentPrice: 60 }),
      holding({ id: "c", isin: null, quantity: 7, avgCostPrice: 80, currentPrice: 90 }),
    ]);
    expect(groups).toHaveLength(2);
    const grouped = groups.find((g) => g.legs.length === 2)!;
    const standalone = groups.find((g) => g.legs.length === 1)!;
    expect(grouped.totalQuantity).toBe(30);
    expect(standalone.legs[0]!.id).toBe("c");
  });
});
