import { prisma } from "../src/lib/db/prisma";
import { SEED_BROKERS } from "../src/lib/brokers/registry";

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

  console.log("Reference data seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
