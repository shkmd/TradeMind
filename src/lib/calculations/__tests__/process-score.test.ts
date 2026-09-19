import { describe, it, expect } from "vitest";
import { computeProcessScore } from "../process-score";

describe("computeProcessScore", () => {
  it("returns null when there are no applicable rules and no journal", () => {
    const result = computeProcessScore({
      ruleEvaluations: [{ result: "NOT_APPLICABLE" }],
      journalCompleted: false,
    });
    expect(result.score).toBeNull();
  });

  it("blends rule compliance and journal completion 70/30 when both exist", () => {
    // 3 applicable rules, 2 pass -> 66.67% rule compliance; journal completed -> 100
    const result = computeProcessScore({
      ruleEvaluations: [{ result: "PASS" }, { result: "PASS" }, { result: "FAIL" }, { result: "NOT_APPLICABLE" }],
      journalCompleted: true,
    });
    // 0.7 * 66.667 + 0.3 * 100 = 46.667 + 30 = 76.667 -> rounds to 77
    expect(result.score).toBe(77);
    expect(result.breakdown.applicableRuleCount).toBe(3);
  });

  it("is journal-only when no rules are applicable", () => {
    const result = computeProcessScore({
      ruleEvaluations: [{ result: "NOT_APPLICABLE" }],
      journalCompleted: true,
    });
    expect(result.score).toBe(100);
  });

  it("is rule-only when the journal isn't completed but rules exist", () => {
    const result = computeProcessScore({
      ruleEvaluations: [{ result: "PASS" }, { result: "FAIL" }],
      journalCompleted: false,
    });
    // 0.7 * 50 + 0.3 * 0 = 35
    expect(result.score).toBe(35);
  });

  it("a profitable trade can still score poorly on process (score is independent of outcome)", () => {
    // All rules failed despite (hypothetically) being profitable — the
    // function only ever sees compliance inputs, never P&L, which is the
    // structural guarantee that outcome and process stay decoupled.
    const result = computeProcessScore({
      ruleEvaluations: [{ result: "FAIL" }, { result: "FAIL" }],
      journalCompleted: false,
    });
    expect(result.score).toBe(0);
  });
});
