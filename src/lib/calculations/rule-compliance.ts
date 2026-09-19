import Decimal from "decimal.js";
import type { RuleEvalResult, TradingRuleType } from "@prisma/client";

export interface RuleEvalContext {
  trade: {
    netPnl: Decimal | null;
    entryAvgPrice: Decimal;
  };
  journal: {
    completedAt: Date | null;
    plannedStopLoss: Decimal | null;
    plannedTarget: Decimal | null;
  } | null;
  /** Number of trades the user opened on the same calendar day as this trade, including this one. */
  sameDayTradeCount: number;
  /** Capital the "max loss %" rule is measured against (e.g. Profile.startingCapital). */
  riskCapital: Decimal | null;
}

export interface RuleEvalOutput {
  result: RuleEvalResult;
  /** Only set when the violation directly cost money (a FAIL with a negative P&L component). */
  violationCost?: Decimal;
  details?: Record<string, unknown>;
}

interface MaxTradesPerDayConfig {
  maxTrades: number;
}
interface MaxLossPerTradePercentConfig {
  maxLossPercent: number;
}
interface MinRiskRewardRatioConfig {
  minRatio: number;
}

export function evaluateRule(
  rule: { ruleType: TradingRuleType; config: unknown },
  context: RuleEvalContext
): RuleEvalOutput {
  switch (rule.ruleType) {
    case "MAX_TRADES_PER_DAY":
      return evaluateMaxTradesPerDay(rule.config as MaxTradesPerDayConfig, context);
    case "MAX_LOSS_PER_TRADE_PERCENT":
      return evaluateMaxLossPerTradePercent(rule.config as MaxLossPerTradePercentConfig, context);
    case "JOURNAL_COMPLETION_REQUIRED":
      return evaluateJournalCompletionRequired(context);
    case "MIN_RISK_REWARD_RATIO":
      return evaluateMinRiskRewardRatio(rule.config as MinRiskRewardRatioConfig, context);
    default: {
      const exhaustiveCheck: never = rule.ruleType;
      throw new Error(`Unhandled trading rule type: ${exhaustiveCheck}`);
    }
  }
}

function evaluateMaxTradesPerDay(
  config: MaxTradesPerDayConfig,
  context: RuleEvalContext
): RuleEvalOutput {
  const withinLimit = context.sameDayTradeCount <= config.maxTrades;
  if (withinLimit) return { result: "PASS", details: { sameDayTradeCount: context.sameDayTradeCount } };

  const netPnl = context.trade.netPnl;
  const violationCost = netPnl && netPnl.isNegative() ? netPnl.abs() : undefined;
  return {
    result: "FAIL",
    violationCost,
    details: { sameDayTradeCount: context.sameDayTradeCount, maxTrades: config.maxTrades },
  };
}

function evaluateMaxLossPerTradePercent(
  config: MaxLossPerTradePercentConfig,
  context: RuleEvalContext
): RuleEvalOutput {
  const { netPnl } = context.trade;
  if (!context.riskCapital || context.riskCapital.isZero()) {
    return { result: "NOT_APPLICABLE", details: { reason: "No risk capital configured" } };
  }
  if (!netPnl || !netPnl.isNegative()) {
    return { result: "PASS", details: { lossPercent: 0 } };
  }

  const lossPercent = netPnl.abs().dividedBy(context.riskCapital).times(100);
  if (lossPercent.lessThanOrEqualTo(config.maxLossPercent)) {
    return { result: "PASS", details: { lossPercent: lossPercent.toNumber() } };
  }

  const allowedLoss = context.riskCapital.times(config.maxLossPercent).dividedBy(100);
  const violationCost = netPnl.abs().minus(allowedLoss);
  return {
    result: "FAIL",
    violationCost: violationCost.isPositive() ? violationCost : undefined,
    details: { lossPercent: lossPercent.toNumber(), maxLossPercent: config.maxLossPercent },
  };
}

function evaluateJournalCompletionRequired(context: RuleEvalContext): RuleEvalOutput {
  const completed = Boolean(context.journal?.completedAt);
  return { result: completed ? "PASS" : "FAIL", details: { completed } };
}

function evaluateMinRiskRewardRatio(
  config: MinRiskRewardRatioConfig,
  context: RuleEvalContext
): RuleEvalOutput {
  const stopLoss = context.journal?.plannedStopLoss;
  const target = context.journal?.plannedTarget;
  if (!stopLoss || !target) {
    return { result: "NOT_APPLICABLE", details: { reason: "No planned stop-loss/target recorded" } };
  }

  const risk = context.trade.entryAvgPrice.minus(stopLoss).abs();
  const reward = target.minus(context.trade.entryAvgPrice).abs();
  if (risk.isZero()) {
    return { result: "NOT_APPLICABLE", details: { reason: "Planned stop-loss equals entry price" } };
  }

  const ratio = reward.dividedBy(risk);
  const passes = ratio.greaterThanOrEqualTo(config.minRatio);
  return {
    result: passes ? "PASS" : "FAIL",
    details: { ratio: ratio.toNumber(), minRatio: config.minRatio },
  };
}
