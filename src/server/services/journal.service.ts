import { prisma } from "@/lib/db/prisma";
import type { TradeJournalInput } from "@/lib/validation/journal";
import { evaluateAndScoreTrade } from "@/server/services/trade-scoring.service";

export async function saveTradeJournal(userId: string, input: TradeJournalInput): Promise<void> {
  const trade = await prisma.trade.findFirstOrThrow({ where: { id: input.tradeId, userId } });

  await prisma.tradeJournal.upsert({
    where: { tradeId: trade.id },
    update: {
      setupNotes: input.setupNotes,
      entryReason: input.entryReason,
      plannedStopLoss: input.plannedStopLoss,
      plannedTarget: input.plannedTarget,
      confidenceLevel: input.confidenceLevel,
      exitReason: input.exitReason,
      setupFollowed: input.setupFollowed,
      stopLossFollowed: input.stopLossFollowed,
      whatWentWell: input.whatWentWell,
      whatWentWrong: input.whatWentWrong,
      lessonLearned: input.lessonLearned,
      rating: input.rating,
      emotionId: input.emotionId || undefined,
      completedAt: input.markComplete ? new Date() : undefined,
    },
    create: {
      tradeId: trade.id,
      userId,
      setupNotes: input.setupNotes,
      entryReason: input.entryReason,
      plannedStopLoss: input.plannedStopLoss,
      plannedTarget: input.plannedTarget,
      confidenceLevel: input.confidenceLevel,
      exitReason: input.exitReason,
      setupFollowed: input.setupFollowed,
      stopLossFollowed: input.stopLossFollowed,
      whatWentWell: input.whatWentWell,
      whatWentWrong: input.whatWentWrong,
      lessonLearned: input.lessonLearned,
      rating: input.rating,
      emotionId: input.emotionId || undefined,
      completedAt: input.markComplete ? new Date() : undefined,
    },
  });

  await prisma.auditLog.create({
    data: { userId, action: "TRADE_JOURNAL_SAVED", entityType: "Trade", entityId: trade.id },
  });

  // Re-evaluate rules/process score now that journal state may have changed
  // (JOURNAL_COMPLETION_REQUIRED and MIN_RISK_REWARD_RATIO both depend on it).
  await evaluateAndScoreTrade(trade.id);
}
