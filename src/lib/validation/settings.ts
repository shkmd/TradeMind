import { z } from "zod";
import { optionalNumber } from "./shared";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  startingCapital: optionalNumber(z.coerce.number().min(0)),
  maxRiskPerTradePct: optionalNumber(z.coerce.number().min(0).max(100)),
  maxDailyLossAmount: optionalNumber(z.coerce.number().min(0)),
  maxTradesPerDay: optionalNumber(z.coerce.number().int().min(1)),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
