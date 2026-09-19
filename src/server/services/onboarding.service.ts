import { prisma } from "@/lib/db/prisma";
import type { OnboardingInput } from "@/lib/validation/onboarding";

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  await prisma.profile.update({
    where: { userId },
    data: {
      displayName: input.displayName,
      timezone: input.timezone,
      fyStartMonth: input.fyStartMonth,
      experienceLevel: input.experienceLevel,
      traderProfileType: input.traderProfileType,
      startingCapital: input.startingCapital,
      maxRiskPerTradePct: input.maxRiskPerTradePct,
      maxDailyLossAmount: input.maxDailyLossAmount,
      maxTradesPerDay: input.maxTradesPerDay,
      minRiskRewardRatio: input.minRiskRewardRatio,
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.riskProfile.upsert({
    where: { userId },
    update: {
      maxRiskPerTradePct: input.maxRiskPerTradePct,
      maxDailyLossAmount: input.maxDailyLossAmount,
      maxTradesPerDay: input.maxTradesPerDay,
    },
    create: {
      userId,
      maxRiskPerTradePct: input.maxRiskPerTradePct,
      maxDailyLossAmount: input.maxDailyLossAmount,
      maxTradesPerDay: input.maxTradesPerDay,
    },
  });

  await prisma.auditLog.create({
    data: { userId, action: "ONBOARDING_COMPLETED", entityType: "Profile", entityId: userId },
  });
}
