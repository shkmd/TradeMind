import { prisma } from "@/lib/db/prisma";
import type { CreateBrokerAccountInput } from "@/lib/validation/broker-account";

export async function listBrokerAccounts(userId: string) {
  return prisma.brokerAccount.findMany({
    where: { userId, deletedAt: null },
    include: {
      broker: true,
      connections: true,
      _count: { select: { trades: true, importJobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBrokerAccount(userId: string, id: string) {
  return prisma.brokerAccount.findFirst({
    where: { id, userId, deletedAt: null },
    include: { broker: true, connections: true, importJobs: { orderBy: { createdAt: "desc" } } },
  });
}

export async function createBrokerAccount(userId: string, input: CreateBrokerAccountInput) {
  const broker = await prisma.broker.findUniqueOrThrow({ where: { code: input.brokerCode } });

  return prisma.brokerAccount.create({
    data: {
      userId,
      brokerId: broker.id,
      nickname: input.nickname,
      startingCapital: input.startingCapital,
      accountType: broker.isImplemented ? "MANUAL_IMPORT" : "MANUAL_ENTRY",
      connections: broker.isImplemented
        ? { create: { connectionType: "CSV_IMPORT", status: "ACTIVE" } }
        : undefined,
    },
  });
}

/**
 * Soft-deletes a broker account and everything derived from it (executions,
 * trades) and marks its import jobs ROLLED_BACK — a full reset for that
 * connection. Never touches shared master data (Instrument/Exchange rows)
 * or the BrokerConnection row itself, since those aren't owned exclusively
 * by this account's history.
 */
export async function deleteBrokerAccount(userId: string, brokerAccountId: string): Promise<void> {
  await prisma.brokerAccount.findFirstOrThrow({ where: { id: brokerAccountId, userId, deletedAt: null } });

  const now = new Date();
  await prisma.execution.updateMany({
    where: { brokerAccountId, deletedAt: null },
    data: { deletedAt: now },
  });
  await prisma.trade.updateMany({
    where: { brokerAccountId, userId, deletedAt: null },
    data: { deletedAt: now },
  });
  await prisma.importJob.updateMany({
    where: { brokerAccountId, userId, status: { not: "ROLLED_BACK" } },
    data: { status: "ROLLED_BACK", rolledBackAt: now },
  });
  await prisma.brokerAccount.update({
    where: { id: brokerAccountId },
    data: { deletedAt: now },
  });
}
