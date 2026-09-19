import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import type { UpdateProfileInput, ChangePasswordInput } from "@/lib/validation/settings";

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: {
      displayName: input.displayName,
      startingCapital: input.startingCapital,
      maxRiskPerTradePct: input.maxRiskPerTradePct,
      maxDailyLossAmount: input.maxDailyLossAmount,
      maxTradesPerDay: input.maxTradesPerDay,
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { name: input.displayName } });
}

export class IncorrectPasswordError extends Error {
  constructor() {
    super("Current password is incorrect.");
    this.name = "IncorrectPasswordError";
  }
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw new IncorrectPasswordError();

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new IncorrectPasswordError();

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await prisma.auditLog.create({
    data: { userId, action: "PASSWORD_CHANGED", entityType: "User", entityId: userId },
  });
}
