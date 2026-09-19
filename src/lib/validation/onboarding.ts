import { z } from "zod";

export const onboardingSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  timezone: z.string().min(1),
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "EXPERIENCED", "PROFESSIONAL"]),
  traderProfileType: z.enum(["INVESTOR", "SWING", "INTRADAY", "OPTIONS", "ALGO"]),
  startingCapital: z.coerce.number().positive("Enter a positive amount"),
  maxRiskPerTradePct: z.coerce.number().min(0).max(100),
  maxDailyLossAmount: z.coerce.number().min(0),
  maxTradesPerDay: z.coerce.number().int().min(1),
  minRiskRewardRatio: z.coerce.number().min(0),
  dataChoice: z.enum(["DEMO", "OWN_IMPORT"]),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
