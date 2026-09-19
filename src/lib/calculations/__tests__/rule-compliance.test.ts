import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { evaluateRule, type RuleEvalContext } from "../rule-compliance";

function baseContext(overrides: Partial<RuleEvalContext> = {}): RuleEvalContext {
  return {
    trade: { netPnl: new Decimal(-1000), entryAvgPrice: new Decimal(100) },
    journal: null,
    sameDayTradeCount: 1,
    riskCapital: new Decimal(50000),
    ...overrides,
  };
}

describe("MAX_TRADES_PER_DAY", () => {
  it("passes when within the limit", () => {
    const result = evaluateRule(
      { ruleType: "MAX_TRADES_PER_DAY", config: { maxTrades: 5 } },
      baseContext({ sameDayTradeCount: 3 })
    );
    expect(result.result).toBe("PASS");
  });

  it("fails and reports the loss as violation cost when the limit is exceeded", () => {
    const result = evaluateRule(
      { ruleType: "MAX_TRADES_PER_DAY", config: { maxTrades: 5 } },
      baseContext({ sameDayTradeCount: 6, trade: { netPnl: new Decimal(-450), entryAvgPrice: new Decimal(100) } })
    );
    expect(result.result).toBe("FAIL");
    expect(result.violationCost?.toNumber()).toBe(450);
  });

  it("fails without a violation cost when the excess trade was profitable", () => {
    const result = evaluateRule(
      { ruleType: "MAX_TRADES_PER_DAY", config: { maxTrades: 5 } },
      baseContext({ sameDayTradeCount: 6, trade: { netPnl: new Decimal(300), entryAvgPrice: new Decimal(100) } })
    );
    expect(result.result).toBe("FAIL");
    expect(result.violationCost).toBeUndefined();
  });
});

describe("MAX_LOSS_PER_TRADE_PERCENT", () => {
  it("is not applicable without configured risk capital", () => {
    const result = evaluateRule(
      { ruleType: "MAX_LOSS_PER_TRADE_PERCENT", config: { maxLossPercent: 2 } },
      baseContext({ riskCapital: null })
    );
    expect(result.result).toBe("NOT_APPLICABLE");
  });

  it("passes on a winning trade regardless of size", () => {
    const result = evaluateRule(
      { ruleType: "MAX_LOSS_PER_TRADE_PERCENT", config: { maxLossPercent: 2 } },
      baseContext({ trade: { netPnl: new Decimal(5000), entryAvgPrice: new Decimal(100) } })
    );
    expect(result.result).toBe("PASS");
  });

  it("fails and computes the excess loss beyond the allowed percentage", () => {
    // riskCapital 50000, maxLossPercent 2% -> allowed loss 1000. Actual loss 1500 -> excess 500.
    const result = evaluateRule(
      { ruleType: "MAX_LOSS_PER_TRADE_PERCENT", config: { maxLossPercent: 2 } },
      baseContext({ trade: { netPnl: new Decimal(-1500), entryAvgPrice: new Decimal(100) } })
    );
    expect(result.result).toBe("FAIL");
    expect(result.violationCost?.toNumber()).toBe(500);
  });
});

describe("JOURNAL_COMPLETION_REQUIRED", () => {
  it("fails when there is no journal", () => {
    const result = evaluateRule({ ruleType: "JOURNAL_COMPLETION_REQUIRED", config: {} }, baseContext());
    expect(result.result).toBe("FAIL");
  });

  it("passes once the journal is completed", () => {
    const result = evaluateRule(
      { ruleType: "JOURNAL_COMPLETION_REQUIRED", config: {} },
      baseContext({ journal: { completedAt: new Date(), plannedStopLoss: null, plannedTarget: null } })
    );
    expect(result.result).toBe("PASS");
  });
});

describe("MIN_RISK_REWARD_RATIO", () => {
  it("is not applicable without a planned stop-loss and target", () => {
    const result = evaluateRule(
      { ruleType: "MIN_RISK_REWARD_RATIO", config: { minRatio: 1.5 } },
      baseContext({ journal: { completedAt: null, plannedStopLoss: null, plannedTarget: null } })
    );
    expect(result.result).toBe("NOT_APPLICABLE");
  });

  it("passes when the planned reward:risk meets the minimum", () => {
    // entry 100, stop 95 (risk 5), target 110 (reward 10) -> ratio 2.0
    const result = evaluateRule(
      { ruleType: "MIN_RISK_REWARD_RATIO", config: { minRatio: 1.5 } },
      baseContext({
        trade: { netPnl: null, entryAvgPrice: new Decimal(100) },
        journal: { completedAt: null, plannedStopLoss: new Decimal(95), plannedTarget: new Decimal(110) },
      })
    );
    expect(result.result).toBe("PASS");
  });

  it("fails when the planned ratio is below the minimum", () => {
    // entry 100, stop 95 (risk 5), target 104 (reward 4) -> ratio 0.8
    const result = evaluateRule(
      { ruleType: "MIN_RISK_REWARD_RATIO", config: { minRatio: 1.5 } },
      baseContext({
        trade: { netPnl: null, entryAvgPrice: new Decimal(100) },
        journal: { completedAt: null, plannedStopLoss: new Decimal(95), plannedTarget: new Decimal(104) },
      })
    );
    expect(result.result).toBe("FAIL");
  });
});
