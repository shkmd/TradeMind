import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import type { RegisterInput } from "@/lib/validation/auth";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Creates a new Trader user: hashed credentials, TRADER role, and a blank
 * Profile row so /onboarding always has something to update rather than
 * needing to upsert.
 */
export async function registerTrader(input: RegisterInput) {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new EmailAlreadyRegisteredError();

  const passwordHash = await bcrypt.hash(input.password, 12);

  const traderRole = await prisma.role.upsert({
    where: { key: "TRADER" },
    update: {},
    create: { key: "TRADER", name: "Trader" },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash,
      userRoles: { create: { roleId: traderRole.id } },
      profile: { create: { displayName: input.name } },
      subscription: { create: {} },
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "USER_REGISTERED", entityType: "User", entityId: user.id },
  });

  return user;
}
