import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { evaluateRule } from "@/lib/calculations/rule-compliance";
import { computeProcessScore } from "@/lib/calculations/process-score";
import { Prisma, type RuleEvalResult } from "@prisma/client";

/**
 * Re-evaluates every active trading rule against one trade, and recomputes
 * its process score. Called right after a trade is created by the import
 * pipeline (covers rules that don't depend on the journal, e.g. max
 * trades/day) and again whenever the trade's journal is saved (covers
 * JOURNAL_COMPLETION_REQUIRED and MIN_RISK_REWARD_RATIO, which do).
 */
export async function evaluateAndScoreTrade(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUniqueOrThrow({
    where: { id: tradeId },
    include: { journal: true },
  });

  const [rules, profile, sameDayTradeCount] = await Promise.all([
    prisma.tradingRule.findMany({ where: { userId: trade.userId, isActive: true } }),
    prisma.profile.findUnique({ where: { userId: trade.userId } }),
    prisma.trade.count({
      where: {
        userId: trade.userId,
        openedAt: { gte: startOfDay(trade.openedAt), lt: endOfDay(trade.openedAt) },
      },
    }),
  ]);

  const context = {
    trade: { netPnl: trade.netPnl ? new Decimal(trade.netPnl.toString()) : null, entryAvgPrice: new Decimal(trade.entryAvgPrice.toString()) },
    journal: trade.journal
      ? {
          completedAt: trade.journal.completedAt,
          plannedStopLoss: trade.journal.plannedStopLoss ? new Decimal(trade.journal.plannedStopLoss.toString()) : null,
          plannedTarget: trade.journal.plannedTarget ? new Decimal(trade.journal.plannedTarget.toString()) : null,
        }
      : null,
    sameDayTradeCount,
    riskCapital: profile?.startingCapital ? new Decimal(profile.startingCapital.toString()) : null,
  };

  const evaluationResults: { ruleId: string; result: RuleEvalResult; violationCost?: Decimal; details?: Record<string, unknown> }[] = [];
  for (const rule of rules) {
    const output = evaluateRule({ ruleType: rule.ruleType, config: rule.config }, context);
    evaluationResults.push({ ruleId: rule.id, ...output });
  }

  await prisma.$transaction(async (tx) => {
    for (const evalResult of evaluationResults) {
      const details = evalResult.details as unknown as Prisma.InputJsonObject | undefined;
      const evaluation = await tx.ruleEvaluation.upsert({
        where: { tradeId_tradingRuleId: { tradeId, tradingRuleId: evalResult.ruleId } },
        update: { result: evalResult.result, details: details ?? Prisma.JsonNull, evaluatedAt: new Date() },
        create: {
          tradeId,
          tradingRuleId: evalResult.ruleId,
          result: evalResult.result,
          details: details ?? Prisma.JsonNull,
        },
      });

      if (evalResult.result === "FAIL" && evalResult.violationCost) {
        await tx.ruleViolation.upsert({
          where: { ruleEvaluationId: evaluation.id },
          update: { financialCost: evalResult.violationCost.toNumber() },
          create: { ruleEvaluationId: evaluation.id, financialCost: evalResult.violationCost.toNumber() },
        });
      } else {
        await tx.ruleViolation.deleteMany({ where: { ruleEvaluationId: evaluation.id } });
      }
    }

    const scoreInput = {
      ruleEvaluations: evaluationResults.map((r) => ({ result: r.result })),
      journalCompleted: Boolean(trade.journal?.completedAt),
    };
    const { score, breakdown } = computeProcessScore(scoreInput);

    await tx.trade.update({
      where: { id: tradeId },
      data: {
        processScore: score,
        ruleComplianceScore:
          breakdown.ruleCompliancePercent !== null ? Math.round(breakdown.ruleCompliancePercent) : null,
      },
    });

    await tx.disciplineScore.create({
      data: {
        userId: trade.userId,
        tradeId,
        score: score ?? 0,
        breakdown: { ...breakdown, scored: score !== null } as unknown as Prisma.InputJsonObject,
      },
    });
  });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
