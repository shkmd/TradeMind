import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeWeightedAveragePrice } from "../weighted-average-price";

describe("computeWeightedAveragePrice", () => {
  it("averages a single lot to its own price", () => {
    const result = computeWeightedAveragePrice([{ quantity: new Decimal(10), price: new Decimal(100) }]);
    expect(result.toNumber()).toBe(100);
  });

  it("weights multiple buys at different prices correctly", () => {
    // 10 @ 100 + 20 @ 130 => (1000 + 2600) / 30 = 120
    const result = computeWeightedAveragePrice([
      { quantity: new Decimal(10), price: new Decimal(100) },
      { quantity: new Decimal(20), price: new Decimal(130) },
    ]);
    expect(result.toNumber()).toBe(120);
  });

  it("throws on zero total quantity rather than dividing by zero", () => {
    expect(() =>
      computeWeightedAveragePrice([
        { quantity: new Decimal(10), price: new Decimal(100) },
        { quantity: new Decimal(-10), price: new Decimal(100) },
      ])
    ).toThrow();
  });
});
