-- CreateEnum
CREATE TYPE "public"."RoleKey" AS ENUM ('TRADER', 'MENTOR', 'ACCOUNTANT', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "public"."BrokerAccountType" AS ENUM ('MANUAL_IMPORT', 'API_CONNECTED', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "public"."BrokerConnectionType" AS ENUM ('CSV_IMPORT', 'API_OAUTH', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."ImportJobStatus" AS ENUM ('PENDING', 'UPLOADED', 'PARSING', 'VALIDATED', 'REVIEW', 'CONFIRMED', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "public"."ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE', 'SKIPPED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "public"."InstrumentSegment" AS ENUM ('EQUITY', 'FUTURES', 'OPTIONS', 'CURRENCY', 'COMMODITY', 'MUTUAL_FUND');

-- CreateEnum
CREATE TYPE "public"."ThesisStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'STRENGTHENING', 'WEAKENING', 'BROKEN', 'EXITED');

-- CreateEnum
CREATE TYPE "public"."TradingRuleType" AS ENUM ('MAX_TRADES_PER_DAY', 'MAX_LOSS_PER_TRADE_PERCENT', 'JOURNAL_COMPLETION_REQUIRED', 'MIN_RISK_REWARD_RATIO');

-- CreateEnum
CREATE TYPE "public"."RuleEvalResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "public"."SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'MENTOR');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "public"."TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "public"."TradeProductType" AS ENUM ('INTRADAY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "public"."TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'PARTIALLY_CLOSED');

-- CreateEnum
CREATE TYPE "public"."TradeExecutionRole" AS ENUM ('ENTRY', 'EXIT');

-- CreateTable
CREATE TABLE "public"."AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "question" TEXT,
    "finding" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "sampleSize" INTEGER,
    "financialImpact" DECIMAL(18,2),
    "confidenceLevel" TEXT,
    "suggestedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InsightEvidence" (
    "id" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "tradeId" TEXT,
    "description" TEXT,

    CONSTRAINT "InsightEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceLabel" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TwoFactorSecret" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" TEXT NOT NULL,
    "key" "public"."RoleKey" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "fyStartMonth" INTEGER NOT NULL DEFAULT 4,
    "experienceLevel" TEXT,
    "traderProfileType" TEXT,
    "marketsTraded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startingCapital" DECIMAL(18,2),
    "maxRiskPerTradePct" DECIMAL(5,2),
    "maxDailyLossAmount" DECIMAL(18,2),
    "maxWeeklyLossAmount" DECIMAL(18,2),
    "maxTradesPerDay" INTEGER,
    "minRiskRewardRatio" DECIMAL(5,2),
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Broker" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isImplemented" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BrokerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "accountType" "public"."BrokerAccountType" NOT NULL DEFAULT 'MANUAL_IMPORT',
    "externalClientId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "purpose" TEXT,
    "startingCapital" DECIMAL(18,2),
    "isManualOrAlgo" TEXT NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BrokerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BrokerConnection" (
    "id" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "connectionType" "public"."BrokerConnectionType" NOT NULL DEFAULT 'CSV_IMPORT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'TRADEBOOK',
    "status" "public"."ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "tradesGenerated" INTEGER NOT NULL DEFAULT 0,
    "parserVersion" TEXT NOT NULL DEFAULT 'zerodha-tradebook-v1',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportFile" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportRow" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "status" "public"."ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "fingerprint" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "executionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerCode" TEXT NOT NULL,
    "columnMap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReconciliationIssue" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Emotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Emotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mistake" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Mistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0E3B2E',

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagOnTrade" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TagOnTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradeJournal" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setupNotes" TEXT,
    "entryReason" TEXT,
    "plannedStopLoss" DECIMAL(18,4),
    "plannedTarget" DECIMAL(18,4),
    "confidenceLevel" INTEGER,
    "exitReason" TEXT,
    "setupFollowed" BOOLEAN,
    "stopLossFollowed" BOOLEAN,
    "whatWentWell" TEXT,
    "whatWentWrong" TEXT,
    "lessonLearned" TEXT,
    "rating" INTEGER,
    "emotionId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradeJournalMistake" (
    "id" TEXT NOT NULL,
    "tradeJournalId" TEXT NOT NULL,
    "mistakeId" TEXT NOT NULL,

    CONSTRAINT "TradeJournalMistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyJournal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journalDate" DATE NOT NULL,
    "marketOutlook" TEXT,
    "maxDailyLoss" DECIMAL(18,2),
    "maxTrades" INTEGER,
    "plannedInstruments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importantEvents" TEXT,
    "energyLevel" INTEGER,
    "openingEmotionId" TEXT,
    "endOfDayReflection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" TEXT,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exchange" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Instrument" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isin" TEXT,
    "name" TEXT,
    "segment" "public"."InstrumentSegment" NOT NULL DEFAULT 'EQUITY',
    "series" TEXT,
    "sector" TEXT,
    "lotSize" INTEGER NOT NULL DEFAULT 1,
    "tickSize" DECIMAL(10,4),
    "underlying" TEXT,
    "expiryDate" TIMESTAMP(3),
    "strikePrice" DECIMAL(18,2),
    "optionType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "avgCostPrice" DECIMAL(18,4) NOT NULL,
    "currentPrice" DECIMAL(18,4),
    "assetClass" TEXT NOT NULL DEFAULT 'EQUITY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HoldingLot" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "price" DECIMAL(18,4),
    "amount" DECIMAL(18,2),
    "transactedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "fromBrokerAccountId" TEXT,
    "toBrokerAccountId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CorporateAction" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ratio" TEXT,
    "exDate" TIMESTAMP(3) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dividend" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "perShare" DECIMAL(18,4),
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvestmentThesis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "purchaseReason" TEXT,
    "thesis" TEXT,
    "expectedHoldingPeriod" TEXT,
    "targetAllocationPct" DECIMAL(5,2),
    "risks" TEXT,
    "exitConditions" TEXT,
    "confidenceScore" INTEGER,
    "status" "public"."ThesisStatus" NOT NULL DEFAULT 'ACTIVE',
    "reviewFrequency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentThesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "s3Key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RiskProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxRiskPerTradePct" DECIMAL(5,2),
    "maxDailyLossAmount" DECIMAL(18,2),
    "maxWeeklyLossAmount" DECIMAL(18,2),
    "maxTradesPerDay" INTEGER,
    "maxConsecutiveLosses" INTEGER,
    "maxProfitGiveBackPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradingRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleType" "public"."TradingRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RuleEvaluation" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "tradingRuleId" TEXT NOT NULL,
    "result" "public"."RuleEvalResult" NOT NULL,
    "details" JSONB,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RuleViolation" (
    "id" TEXT NOT NULL,
    "ruleEvaluationId" TEXT NOT NULL,
    "financialCost" DECIMAL(18,2),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BehaviourEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patternCode" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "financialImpact" DECIMAL(18,2),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviourEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DisciplineScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" TEXT,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DrawdownPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "peakCapital" DECIMAL(18,2) NOT NULL,
    "troughCapital" DECIMAL(18,2),
    "startedAt" TIMESTAMP(3) NOT NULL,
    "recoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawdownPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScenarioSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "results" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "public"."SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "razorpaySubscriptionId" TEXT,
    "razorpayCustomerId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "brokerOrderId" TEXT NOT NULL,
    "orderType" TEXT,
    "side" "public"."TradeSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,4),
    "status" TEXT,
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Execution" (
    "id" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "orderId" TEXT,
    "brokerTradeId" TEXT NOT NULL,
    "brokerOrderId" TEXT NOT NULL,
    "side" "public"."TradeSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "exchange" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "series" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "strategyId" TEXT,
    "side" "public"."TradeSide" NOT NULL,
    "productType" "public"."TradeProductType" NOT NULL,
    "status" "public"."TradeStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "entryAvgPrice" DECIMAL(18,4) NOT NULL,
    "exitAvgPrice" DECIMAL(18,4),
    "grossPnl" DECIMAL(18,2),
    "totalCharges" DECIMAL(18,2),
    "netPnl" DECIMAL(18,2),
    "chargeBreakdown" JSONB,
    "processScore" INTEGER,
    "ruleComplianceScore" INTEGER,
    "setup" TEXT,
    "strategyTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradeExecution" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "role" "public"."TradeExecutionRole" NOT NULL,
    "matchedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "avgCostPrice" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Strategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "strategyType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StrategyLeg" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "tradeId" TEXT,
    "legRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "public"."AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIInsight_userId_idx" ON "public"."AIInsight"("userId");

-- CreateIndex
CREATE INDEX "InsightEvidence_insightId_idx" ON "public"."InsightEvidence"("insightId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "DeviceSession_userId_idx" ON "public"."DeviceSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorSecret_userId_key" ON "public"."TwoFactorSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "public"."Role"("key");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "public"."UserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "public"."UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "public"."Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Broker_code_key" ON "public"."Broker"("code");

-- CreateIndex
CREATE INDEX "BrokerAccount_userId_idx" ON "public"."BrokerAccount"("userId");

-- CreateIndex
CREATE INDEX "BrokerConnection_brokerAccountId_idx" ON "public"."BrokerConnection"("brokerAccountId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_idx" ON "public"."ImportJob"("userId");

-- CreateIndex
CREATE INDEX "ImportJob_brokerAccountId_idx" ON "public"."ImportJob"("brokerAccountId");

-- CreateIndex
CREATE INDEX "ImportFile_importJobId_idx" ON "public"."ImportFile"("importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_executionId_key" ON "public"."ImportRow"("executionId");

-- CreateIndex
CREATE INDEX "ImportRow_importJobId_status_idx" ON "public"."ImportRow"("importJobId", "status");

-- CreateIndex
CREATE INDEX "ImportMapping_userId_brokerCode_idx" ON "public"."ImportMapping"("userId", "brokerCode");

-- CreateIndex
CREATE INDEX "ReconciliationIssue_importJobId_idx" ON "public"."ReconciliationIssue"("importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Emotion_code_key" ON "public"."Emotion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Mistake_code_key" ON "public"."Mistake"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "public"."Tag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TagOnTrade_tradeId_tagId_key" ON "public"."TagOnTrade"("tradeId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeJournal_tradeId_key" ON "public"."TradeJournal"("tradeId");

-- CreateIndex
CREATE INDEX "TradeJournal_userId_idx" ON "public"."TradeJournal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeJournalMistake_tradeJournalId_mistakeId_key" ON "public"."TradeJournalMistake"("tradeJournalId", "mistakeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyJournal_userId_journalDate_key" ON "public"."DailyJournal"("userId", "journalDate");

-- CreateIndex
CREATE INDEX "Attachment_userId_idx" ON "public"."Attachment"("userId");

-- CreateIndex
CREATE INDEX "Attachment_tradeId_idx" ON "public"."Attachment"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_code_key" ON "public"."Exchange"("code");

-- CreateIndex
CREATE INDEX "Instrument_isin_idx" ON "public"."Instrument"("isin");

-- CreateIndex
CREATE INDEX "Instrument_symbol_idx" ON "public"."Instrument"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_exchangeId_symbol_segment_key" ON "public"."Instrument"("exchangeId", "symbol", "segment");

-- CreateIndex
CREATE INDEX "Holding_userId_idx" ON "public"."Holding"("userId");

-- CreateIndex
CREATE INDEX "Holding_brokerAccountId_idx" ON "public"."Holding"("brokerAccountId");

-- CreateIndex
CREATE INDEX "HoldingLot_holdingId_idx" ON "public"."HoldingLot"("holdingId");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_userId_idx" ON "public"."InvestmentTransaction"("userId");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_brokerAccountId_idx" ON "public"."InvestmentTransaction"("brokerAccountId");

-- CreateIndex
CREATE INDEX "AssetTransfer_userId_idx" ON "public"."AssetTransfer"("userId");

-- CreateIndex
CREATE INDEX "CorporateAction_instrumentId_idx" ON "public"."CorporateAction"("instrumentId");

-- CreateIndex
CREATE INDEX "Dividend_holdingId_idx" ON "public"."Dividend"("holdingId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentThesis_holdingId_key" ON "public"."InvestmentThesis"("holdingId");

-- CreateIndex
CREATE INDEX "InvestmentThesis_userId_idx" ON "public"."InvestmentThesis"("userId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "public"."Report"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "public"."Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskProfile_userId_key" ON "public"."RiskProfile"("userId");

-- CreateIndex
CREATE INDEX "TradingRule_userId_idx" ON "public"."TradingRule"("userId");

-- CreateIndex
CREATE INDEX "RuleEvaluation_tradeId_idx" ON "public"."RuleEvaluation"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleEvaluation_tradeId_tradingRuleId_key" ON "public"."RuleEvaluation"("tradeId", "tradingRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleViolation_ruleEvaluationId_key" ON "public"."RuleViolation"("ruleEvaluationId");

-- CreateIndex
CREATE INDEX "BehaviourEvent_userId_idx" ON "public"."BehaviourEvent"("userId");

-- CreateIndex
CREATE INDEX "DisciplineScore_userId_idx" ON "public"."DisciplineScore"("userId");

-- CreateIndex
CREATE INDEX "DisciplineScore_tradeId_idx" ON "public"."DisciplineScore"("tradeId");

-- CreateIndex
CREATE INDEX "DrawdownPeriod_userId_idx" ON "public"."DrawdownPeriod"("userId");

-- CreateIndex
CREATE INDEX "ScenarioSimulation_userId_idx" ON "public"."ScenarioSimulation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "public"."Subscription"("userId");

-- CreateIndex
CREATE INDEX "Order_brokerAccountId_idx" ON "public"."Order"("brokerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_brokerAccountId_brokerOrderId_key" ON "public"."Order"("brokerAccountId", "brokerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_fingerprint_key" ON "public"."Execution"("fingerprint");

-- CreateIndex
CREATE INDEX "Execution_brokerAccountId_instrumentId_executedAt_idx" ON "public"."Execution"("brokerAccountId", "instrumentId", "executedAt");

-- CreateIndex
CREATE INDEX "Execution_fingerprint_idx" ON "public"."Execution"("fingerprint");

-- CreateIndex
CREATE INDEX "Trade_userId_closedAt_idx" ON "public"."Trade"("userId", "closedAt");

-- CreateIndex
CREATE INDEX "Trade_brokerAccountId_idx" ON "public"."Trade"("brokerAccountId");

-- CreateIndex
CREATE INDEX "Trade_instrumentId_idx" ON "public"."Trade"("instrumentId");

-- CreateIndex
CREATE INDEX "TradeExecution_tradeId_idx" ON "public"."TradeExecution"("tradeId");

-- CreateIndex
CREATE INDEX "TradeExecution_executionId_idx" ON "public"."TradeExecution"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeExecution_tradeId_executionId_role_key" ON "public"."TradeExecution"("tradeId", "executionId", "role");

-- CreateIndex
CREATE INDEX "StrategyLeg_strategyId_idx" ON "public"."StrategyLeg"("strategyId");

-- AddForeignKey
ALTER TABLE "public"."AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIInsight" ADD CONSTRAINT "AIInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIInsight" ADD CONSTRAINT "AIInsight_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InsightEvidence" ADD CONSTRAINT "InsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "public"."AIInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TwoFactorSecret" ADD CONSTRAINT "TwoFactorSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrokerAccount" ADD CONSTRAINT "BrokerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrokerAccount" ADD CONSTRAINT "BrokerAccount_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "public"."Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BrokerConnection" ADD CONSTRAINT "BrokerConnection_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "public"."BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportJob" ADD CONSTRAINT "ImportJob_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "public"."BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportFile" ADD CONSTRAINT "ImportFile_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "public"."ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportRow" ADD CONSTRAINT "ImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "public"."ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportRow" ADD CONSTRAINT "ImportRow_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "public"."Execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportMapping" ADD CONSTRAINT "ImportMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "public"."ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagOnTrade" ADD CONSTRAINT "TagOnTrade_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagOnTrade" ADD CONSTRAINT "TagOnTrade_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeJournal" ADD CONSTRAINT "TradeJournal_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeJournal" ADD CONSTRAINT "TradeJournal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeJournal" ADD CONSTRAINT "TradeJournal_emotionId_fkey" FOREIGN KEY ("emotionId") REFERENCES "public"."Emotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeJournalMistake" ADD CONSTRAINT "TradeJournalMistake_tradeJournalId_fkey" FOREIGN KEY ("tradeJournalId") REFERENCES "public"."TradeJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeJournalMistake" ADD CONSTRAINT "TradeJournalMistake_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "public"."Mistake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyJournal" ADD CONSTRAINT "DailyJournal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyJournal" ADD CONSTRAINT "DailyJournal_openingEmotionId_fkey" FOREIGN KEY ("openingEmotionId") REFERENCES "public"."Emotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Instrument" ADD CONSTRAINT "Instrument_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "public"."Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "public"."BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Holding" ADD CONSTRAINT "Holding_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HoldingLot" ADD CONSTRAINT "HoldingLot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "public"."Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dividend" ADD CONSTRAINT "Dividend_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "public"."Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvestmentThesis" ADD CONSTRAINT "InvestmentThesis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvestmentThesis" ADD CONSTRAINT "InvestmentThesis_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "public"."Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiskProfile" ADD CONSTRAINT "RiskProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradingRule" ADD CONSTRAINT "TradingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuleEvaluation" ADD CONSTRAINT "RuleEvaluation_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuleEvaluation" ADD CONSTRAINT "RuleEvaluation_tradingRuleId_fkey" FOREIGN KEY ("tradingRuleId") REFERENCES "public"."TradingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RuleViolation" ADD CONSTRAINT "RuleViolation_ruleEvaluationId_fkey" FOREIGN KEY ("ruleEvaluationId") REFERENCES "public"."RuleEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BehaviourEvent" ADD CONSTRAINT "BehaviourEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DisciplineScore" ADD CONSTRAINT "DisciplineScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DisciplineScore" ADD CONSTRAINT "DisciplineScore_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DrawdownPeriod" ADD CONSTRAINT "DrawdownPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScenarioSimulation" ADD CONSTRAINT "ScenarioSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "public"."BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Execution" ADD CONSTRAINT "Execution_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "public"."BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Execution" ADD CONSTRAINT "Execution_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Execution" ADD CONSTRAINT "Execution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_brokerAccountId_fkey" FOREIGN KEY ("brokerAccountId") REFERENCES "public"."BrokerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "public"."Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeExecution" ADD CONSTRAINT "TradeExecution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "public"."Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeExecution" ADD CONSTRAINT "TradeExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "public"."Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StrategyLeg" ADD CONSTRAINT "StrategyLeg_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
