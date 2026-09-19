import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db/prisma";
import { seedDemoDataForUser, DEMO_TRADING_RULES } from "../src/server/services/demo-data.service";
import { SEED_BROKERS } from "../src/lib/brokers/registry";

const DEMO_EMAIL = "demo@trademind.in";
const DEMO_PASSWORD = "Demo@1234";

async function main() {
  console.log("Seeding roles...");
  const roleKeys = ["TRADER", "MENTOR", "ACCOUNTANT", "ADMINISTRATOR"] as const;
  for (const key of roleKeys) {
    await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name: key.charAt(0) + key.slice(1).toLowerCase() },
    });
  }

  console.log("Seeding exchanges...");
  await prisma.exchange.upsert({
    where: { code: "NSE" },
    update: {},
    create: { code: "NSE", name: "National Stock Exchange" },
  });
  await prisma.exchange.upsert({
    where: { code: "BSE" },
    update: {},
    create: { code: "BSE", name: "Bombay Stock Exchange" },
  });

  console.log("Seeding brokers...");
  for (const broker of SEED_BROKERS) {
    await prisma.broker.upsert({
      where: { code: broker.code },
      update: { name: broker.name, isImplemented: broker.isImplemented },
      create: { code: broker.code, name: broker.name, isImplemented: broker.isImplemented },
    });
  }

  console.log("Seeding lookup tables (emotions, mistakes)...");
  const emotions = [
    ["CALM", "Calm"],
    ["CONFIDENT", "Confident"],
    ["ANXIOUS", "Anxious"],
    ["FOMO", "FOMO"],
    ["REVENGE", "Revenge"],
    ["BORED", "Bored"],
    ["FRUSTRATED", "Frustrated"],
    ["EUPHORIC", "Euphoric"],
  ];
  for (const [code, label] of emotions) {
    await prisma.emotion.upsert({ where: { code: code! }, update: {}, create: { code: code!, label: label! } });
  }

  const mistakes = [
    ["MOVED_STOP", "Moved stop-loss"],
    ["OVERSIZED", "Position oversized"],
    ["NO_STOP", "No stop-loss set"],
    ["FOMO_ENTRY", "FOMO entry"],
    ["REVENGE_TRADE", "Revenge trade"],
    ["EARLY_EXIT", "Exited too early"],
    ["LATE_EXIT", "Exited too late"],
    ["NO_PLAN", "No trade plan"],
  ];
  for (const [code, label] of mistakes) {
    await prisma.mistake.upsert({ where: { code: code! }, update: {}, create: { code: code!, label: label! } });
  }

  console.log("Seeding demo user...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const traderRole = await prisma.role.findUniqueOrThrow({ where: { key: "TRADER" } });

  const existingDemoUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existingDemoUser) {
    console.log("Demo user already exists — wiping their trading data so this seed is re-runnable...");
    await prisma.trade.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.execution.deleteMany({ where: { brokerAccount: { userId: existingDemoUser.id } } });
    await prisma.importJob.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.brokerAccount.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.notification.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.investmentThesis.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.holding.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.dailyJournal.deleteMany({ where: { userId: existingDemoUser.id } });
  }

  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_EMAIL,
      name: "Demo Trader",
      passwordHash,
      userRoles: { create: { roleId: traderRole.id } },
      profile: {
        create: {
          displayName: "Demo Trader",
          experienceLevel: "INTERMEDIATE",
          traderProfileType: "SWING",
          startingCapital: 500000,
          maxRiskPerTradePct: 2,
          maxDailyLossAmount: 10000,
          maxTradesPerDay: 5,
          minRiskRewardRatio: 1.5,
          onboardingCompletedAt: new Date(),
        },
      },
      subscription: { create: { plan: "PRO" } },
      riskProfile: {
        create: {
          maxRiskPerTradePct: 2,
          maxDailyLossAmount: 10000,
          maxTradesPerDay: 5,
        },
      },
    },
  });

  console.log("Seeding trading rules...");
  for (const rule of DEMO_TRADING_RULES) {
    const existing = await prisma.tradingRule.findFirst({ where: { userId: demoUser.id, ruleType: rule.ruleType } });
    if (!existing) {
      await prisma.tradingRule.create({ data: { userId: demoUser.id, ...rule } });
    }
  }

  console.log("Running the real import pipeline against the Zerodha fixture...");
  await seedDemoDataForUser(demoUser.id);

  console.log("Adding journal entries to a couple of seeded trades...");
  const closedTrades = await prisma.trade.findMany({
    where: { userId: demoUser.id, status: "CLOSED" },
    orderBy: { openedAt: "asc" },
    take: 2,
  });
  const calmEmotion = await prisma.emotion.findUnique({ where: { code: "CALM" } });
  for (const trade of closedTrades) {
    await prisma.tradeJournal.upsert({
      where: { tradeId: trade.id },
      update: {},
      create: {
        tradeId: trade.id,
        userId: demoUser.id,
        setupNotes: "Breakout above previous day high with volume confirmation.",
        entryReason: "Price reclaimed VWAP with strong relative volume.",
        plannedStopLoss: trade.entryAvgPrice.mul(0.98),
        plannedTarget: trade.entryAvgPrice.mul(1.03),
        confidenceLevel: 4,
        exitReason: "Target hit / end-of-day square-off.",
        setupFollowed: true,
        stopLossFollowed: true,
        whatWentWell: "Waited for confirmation instead of chasing the first move.",
        whatWentWrong: "Entered slightly late, giving up some of the move.",
        lessonLearned: "Pre-set alerts at the breakout level to enter faster.",
        rating: 4,
        emotionId: calmEmotion?.id,
        completedAt: new Date(),
      },
    });
    const { evaluateAndScoreTrade } = await import("../src/server/services/trade-scoring.service");
    await evaluateAndScoreTrade(trade.id);
  }

  console.log("Seeding illustrative rows for not-yet-wired pages...");
  const brokerAccount = await prisma.brokerAccount.findFirstOrThrow({ where: { userId: demoUser.id } });
  const nseExchange = await prisma.exchange.findUniqueOrThrow({ where: { code: "NSE" } });
  const hdfcInstrument = await prisma.instrument.upsert({
    where: { exchangeId_symbol_segment: { exchangeId: nseExchange.id, symbol: "HDFCBANK", segment: "EQUITY" } },
    update: {},
    create: { exchangeId: nseExchange.id, symbol: "HDFCBANK", isin: "INE040A01034", segment: "EQUITY", name: "HDFC Bank" },
  });

  const holding = await prisma.holding.create({
    data: {
      userId: demoUser.id,
      brokerAccountId: brokerAccount.id,
      instrumentId: hdfcInstrument.id,
      quantity: 40,
      avgCostPrice: 1580,
      currentPrice: 1652.5,
      assetClass: "EQUITY",
    },
  });

  await prisma.investmentThesis.create({
    data: {
      userId: demoUser.id,
      holdingId: holding.id,
      purchaseReason: "Core private-sector banking holding for long-term compounding.",
      thesis: "Consistent loan-book growth, improving CASA ratio post-merger integration.",
      expectedHoldingPeriod: "3-5 years",
      targetAllocationPct: 10,
      risks: "NIM compression if rate cuts accelerate; merger integration risk.",
      exitConditions: "Structural deterioration in asset quality or loss of market share.",
      confidenceScore: 4,
      status: "ACTIVE",
      reviewFrequency: "Quarterly",
    },
  });

  await prisma.dailyJournal.upsert({
    where: { userId_journalDate: { userId: demoUser.id, journalDate: new Date("2024-01-15") } },
    update: {},
    create: {
      userId: demoUser.id,
      journalDate: new Date("2024-01-15"),
      marketOutlook: "Range-bound with a mild upward bias; Nifty holding above 21,500.",
      maxDailyLoss: 10000,
      maxTrades: 5,
      plannedInstruments: ["RELIANCE", "TCS", "INFY"],
      energyLevel: 8,
      openingEmotionId: calmEmotion?.id,
      endOfDayReflection: "Stuck to the plan, took only A-grade setups.",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: demoUser.id,
        type: "WEEKLY_REVIEW_READY",
        title: "Your weekly review is ready",
        body: "Review last week's process score trend and rule violations.",
      },
      {
        userId: demoUser.id,
        type: "BROKER_TOKEN_EXPIRY",
        title: "Reminder: keep imports current",
        body: "Import your latest Zerodha tradebook to keep the dashboard up to date.",
      },
    ],
  });

  console.log(`Seed complete. Log in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
