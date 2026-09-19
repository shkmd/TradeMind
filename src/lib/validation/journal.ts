import { z } from "zod";
import { optionalNumber } from "./shared";

export const tradeJournalSchema = z.object({
  tradeId: z.string().min(1),
  setupNotes: z.string().optional(),
  entryReason: z.string().optional(),
  plannedStopLoss: optionalNumber(z.coerce.number().positive()),
  plannedTarget: optionalNumber(z.coerce.number().positive()),
  confidenceLevel: optionalNumber(z.coerce.number().int().min(1).max(5)),
  exitReason: z.string().optional(),
  setupFollowed: z.coerce.boolean().optional(),
  stopLossFollowed: z.coerce.boolean().optional(),
  whatWentWell: z.string().optional(),
  whatWentWrong: z.string().optional(),
  lessonLearned: z.string().optional(),
  rating: optionalNumber(z.coerce.number().int().min(1).max(5)),
  emotionId: z.string().optional(),
  markComplete: z.coerce.boolean().optional(),
});
export type TradeJournalInput = z.infer<typeof tradeJournalSchema>;
