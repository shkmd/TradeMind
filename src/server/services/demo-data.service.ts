import { readFileSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { uploadImportFile } from "@/lib/storage/s3";
import { runImportPipeline } from "@/lib/import/pipeline";
import { SEED_BROKERS } from "@/lib/brokers/registry";

const FIXTURE_PATH = path.join(process.cwd(), "fixtures", "zerodha-tradebook-sample.csv");

export const DEMO_TRADING_RULES = [
  { ruleType: "MAX_TRADES_PER_DAY" as const, name: "Max 5 trades per day", config: { maxTrades: 5 } },
  { ruleType: "MAX_LOSS_PER_TRADE_PERCENT" as const, name: "Max 2% loss per trade", config: { maxLossPercent: 2 } },
  { ruleType: "JOURNAL_COMPLETION_REQUIRED" as const, name: "Every trade must be journaled", config: {} },
  { ruleType: "MIN_RISK_REWARD_RATIO" as const, name: "Minimum 1.5:1 risk-reward", config: { minRatio: 1.5 } },
];

/**
 * Runs the REAL import pipeline against the bundled Zerodha tradebook
 * fixture for a given user, so demo trades/charges/P&L come from actual
 * code (not hardcoded rows). Used by both the onboarding "load demo data"
 * choice and prisma/seed.ts.
 *
 * Idempotent: if this user already has a demo account (e.g. they hit
 * onboarding more than once), this is a no-op rather than piling up
 * duplicate accounts/trades.
 */
export async function seedDemoDataForUser(userId: string): Promise<void> {
  const existingDemoAccount = await prisma.brokerAccount.findFirst({
    where: { userId, nickname: "Zerodha — Demo" },
  });
  if (existingDemoAccount) return;

  const zerodhaBroker = await prisma.broker.upsert({
    where: { code: "ZERODHA" },
    update: { isImplemented: true },
    create: { code: "ZERODHA", name: "Zerodha", isImplemented: true },
  });

  for (const broker of SEED_BROKERS) {
    if (broker.code === "ZERODHA") continue;
    await prisma.broker.upsert({
      where: { code: broker.code },
      // Keep isImplemented in sync with the registry — otherwise a broker
      // promoted from stub to implemented here never updates existing rows.
      update: { name: broker.name, isImplemented: broker.isImplemented },
      create: { code: broker.code, name: broker.name, isImplemented: broker.isImplemented },
    });
  }

  const brokerAccount = await prisma.brokerAccount.create({
    data: {
      userId,
      brokerId: zerodhaBroker.id,
      nickname: "Zerodha — Demo",
      accountType: "MANUAL_IMPORT",
      externalClientId: "ZD" + userId.slice(-6).toUpperCase(),
      startingCapital: 500000,
      connections: { create: { connectionType: "CSV_IMPORT", status: "ACTIVE", lastSyncedAt: new Date() } },
    },
  });

  // Without these, every seeded trade scores processScore/ruleComplianceScore
  // as null (nothing to evaluate against) — the dashboard would show "—"
  // instead of real numbers despite trades existing.
  for (const rule of DEMO_TRADING_RULES) {
    const existingRule = await prisma.tradingRule.findFirst({ where: { userId, ruleType: rule.ruleType } });
    if (!existingRule) {
      await prisma.tradingRule.create({ data: { userId, ...rule } });
    }
  }

  const fileBuffer = readFileSync(FIXTURE_PATH);
  const checksum = createHash("sha256").update(fileBuffer).digest("hex");
  const s3Key = `demo/${userId}/zerodha-tradebook-sample-${Date.now()}.csv`;
  await uploadImportFile(s3Key, fileBuffer, "text/csv");

  const importJob = await prisma.importJob.create({
    data: {
      userId,
      brokerAccountId: brokerAccount.id,
      broker: "ZERODHA",
      reportType: "TRADEBOOK",
      status: "UPLOADED",
      files: {
        create: {
          originalName: "zerodha-tradebook-sample.csv",
          s3Key,
          s3Bucket: process.env.S3_BUCKET_IMPORTS ?? "trademind-imports",
          mimeType: "text/csv",
          sizeBytes: fileBuffer.byteLength,
          checksumSha256: checksum,
        },
      },
    },
  });

  await runImportPipeline(importJob.id);

  await prisma.notification.create({
    data: {
      userId,
      type: "IMPORT_COMPLETED",
      title: "Demo data loaded",
      body: "Your Zerodha demo tradebook has been imported and your dashboard is ready.",
    },
  });
}
