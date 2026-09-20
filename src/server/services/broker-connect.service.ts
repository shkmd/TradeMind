import { prisma } from "@/lib/db/prisma";
import { getApiConnector, getDirectLoginConnector } from "@/lib/brokers/api-connector-registry";
import { matchEquityInstrumentByName } from "@/server/services/instrument.service";
import { encryptToken, decryptToken } from "@/lib/crypto/token-encryption";
import { persistExecutionIfNew, regenerateTradesForInstruments } from "@/lib/import/execution-ingest";
import type { CanonicalExecutionRow } from "@/lib/brokers/adapter";
import type { CanonicalHoldingRow } from "@/lib/brokers/api-connector";

/**
 * Lives here rather than in the "use server" actions file — that file may
 * only export async functions, never a plain constant.
 */
export const PENDING_CONNECTION_COOKIE = "broker_connect_pending_connection_id";

export class BrokerNotLiveCapableError extends Error {
  constructor(brokerCode: string) {
    super(`${brokerCode} does not have a live API connector configured yet — use CSV import instead.`);
    this.name = "BrokerNotLiveCapableError";
  }
}

export class BrokerApiNotConfiguredError extends Error {
  constructor(brokerCode: string) {
    super(
      `${brokerCode}'s live connector is implemented but no API credentials are configured on this server ` +
        `(see .env.example) — the account owner needs their own developer app for this broker.`
    );
    this.name = "BrokerApiNotConfiguredError";
  }
}

type ResolvedConnector =
  | { kind: "redirect"; connector: NonNullable<ReturnType<typeof getApiConnector>> }
  | { kind: "direct"; connector: NonNullable<ReturnType<typeof getDirectLoginConnector>> };

/** Loads whichever connector type this broker uses, or throws a specific, user-facing error. */
function resolveConnector(brokerCode: string): ResolvedConnector {
  const redirectConnector = getApiConnector(brokerCode);
  if (redirectConnector) {
    if (!redirectConnector.isConfigured()) throw new BrokerApiNotConfiguredError(brokerCode);
    return { kind: "redirect", connector: redirectConnector };
  }
  const directConnector = getDirectLoginConnector(brokerCode);
  if (directConnector) {
    if (!directConnector.isConfigured()) throw new BrokerApiNotConfiguredError(brokerCode);
    return { kind: "direct", connector: directConnector };
  }
  throw new BrokerNotLiveCapableError(brokerCode);
}

async function getAccountAndConnector(brokerAccountId: string) {
  const account = await prisma.brokerAccount.findUniqueOrThrow({
    where: { id: brokerAccountId },
    include: { broker: true },
  });
  return { account, resolved: resolveConnector(account.broker.code) };
}

function findOrInitApiOAuthConnection(brokerAccountId: string) {
  return prisma.brokerConnection.findFirst({ where: { brokerAccountId, connectionType: "API_OAUTH" } });
}

/**
 * Step 1 of the redirect-login flow (Zerodha/Dhan/Upstox only — see
 * directLoginAndSync for Angel One/Kotak): creates/reuses a PENDING
 * BrokerConnection and returns the broker's own login URL to redirect the
 * user to. The caller (a Server Action) is responsible for setting a
 * short-lived cookie naming this connection, since none of these brokers
 * forward arbitrary state back to us — only a one-time token/code.
 */
export async function initiateLiveConnect(
  userId: string,
  brokerAccountId: string
): Promise<{ loginUrl: string; connectionId: string }> {
  const account = await prisma.brokerAccount.findFirst({ where: { id: brokerAccountId, userId } });
  if (!account) throw new Error("Broker account not found.");

  const { resolved } = await getAccountAndConnector(brokerAccountId);
  if (resolved.kind !== "redirect") {
    throw new Error(`${account.brokerId} uses direct login, not a redirect — call directLoginAndSync instead.`);
  }

  // A CSV_IMPORT connection may already exist for this account (created
  // when the account was added) — never touch that one; only look for/create
  // the separate API_OAUTH connection that represents a live session.
  const existing = await findOrInitApiOAuthConnection(brokerAccountId);
  const connection = existing
    ? await prisma.brokerConnection.update({
        where: { id: existing.id },
        data: { status: "PENDING", connectionType: "API_OAUTH" },
      })
    : await prisma.brokerConnection.create({
        data: { brokerAccountId, connectionType: "API_OAUTH", status: "PENDING" },
      });

  return { loginUrl: await resolved.connector.buildLoginUrl(connection.id), connectionId: connection.id };
}

/**
 * Step 2 of the redirect-login flow: called from the OAuth callback route
 * with the one-time token/code the broker sent back and the pending
 * connectionId read from our own cookie. Exchanges the token, encrypts it,
 * and activates the connection.
 */
export async function completeLiveConnect(connectionId: string, requestToken: string): Promise<void> {
  const connection = await prisma.brokerConnection.findUniqueOrThrow({
    where: { id: connectionId },
    include: { brokerAccount: { include: { broker: true } } },
  });

  const resolved = resolveConnector(connection.brokerAccount.broker.code);
  if (resolved.kind !== "redirect") throw new BrokerNotLiveCapableError(connection.brokerAccount.broker.code);

  const exchanged = await resolved.connector.exchangeRequestToken(requestToken);

  await prisma.brokerConnection.update({
    where: { id: connectionId },
    data: {
      status: "ACTIVE",
      accessTokenEncrypted: encryptToken(exchanged.accessToken),
      // Reused as a generic "extra session data" slot (not a real OAuth
      // refresh token) — Kotak needs both a sid AND a token on every
      // request; Zerodha/Dhan/Upstox just get "{}" here.
      refreshTokenEncrypted: encryptToken(JSON.stringify(exchanged.session ?? {})),
      tokenExpiresAt: exchanged.expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: connection.brokerAccount.userId,
      action: "BROKER_LIVE_CONNECT_COMPLETED",
      entityType: "BrokerConnection",
      entityId: connectionId,
    },
  });
}

/**
 * The Angel One / Kotak equivalent of the two steps above, collapsed into
 * one: there's no redirect round trip, so login + activate happen in a
 * single server action call. `credentials` is used once to call the
 * broker's own login API and is never persisted — only the resulting
 * ExchangedToken (accessToken + any extra session data) is stored, encrypted.
 */
export async function directLoginAndConnect(
  userId: string,
  brokerAccountId: string,
  credentials: Record<string, string>
): Promise<void> {
  const account = await prisma.brokerAccount.findFirst({ where: { id: brokerAccountId, userId } });
  if (!account) throw new Error("Broker account not found.");

  const { resolved } = await getAccountAndConnector(brokerAccountId);
  if (resolved.kind !== "direct") {
    throw new Error(`This broker uses a redirect login, not direct credentials.`);
  }

  const exchanged = await resolved.connector.login(credentials);

  const existing = await findOrInitApiOAuthConnection(brokerAccountId);
  const data = {
    status: "ACTIVE" as const,
    connectionType: "API_OAUTH" as const,
    accessTokenEncrypted: encryptToken(exchanged.accessToken),
    refreshTokenEncrypted: encryptToken(JSON.stringify(exchanged.session ?? {})),
    tokenExpiresAt: exchanged.expiresAt,
    // Angel One/Kotak: each user's own API key, submitted in this same form
    // (see live-connect-card.tsx) — stored in its own field, separately
    // from the general session blob above, since unlike a session it's a
    // long-lived credential the user provided rather than something the
    // broker issued us.
    ...(credentials.apiKey ? { apiKeyEncrypted: encryptToken(credentials.apiKey) } : {}),
  };
  const connection = existing
    ? await prisma.brokerConnection.update({ where: { id: existing.id }, data })
    : await prisma.brokerConnection.create({ data: { brokerAccountId, ...data } });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "BROKER_LIVE_CONNECT_COMPLETED",
      entityType: "BrokerConnection",
      entityId: connection.id,
    },
  });
}

export interface LiveSyncResult {
  tradesFetched: number;
  tradesImported: number;
  duplicateTrades: number;
  holdingsSynced: number;
  tradesGenerated: number;
}

/**
 * Pulls today's fills + current holdings from the live API (whichever
 * connector type this broker uses) and feeds them through the exact same
 * dedupe/trade-grouping/charge pipeline that CSV import uses
 * (lib/import/execution-ingest.ts) — so a trade imported via CSV and one
 * pulled live are indistinguishable downstream.
 *
 * Most brokers' live trade-history endpoint only returns the CURRENT
 * trading day's fills (Upstox's historical-trades endpoint is the
 * exception) — that's a live-API limitation, not a bug here. Historical
 * backfill is what CSV Tradebook import is for.
 */
export async function syncLiveAccount(userId: string, brokerAccountId: string): Promise<LiveSyncResult> {
  const account = await prisma.brokerAccount.findFirst({
    where: { id: brokerAccountId, userId },
    include: { connections: true, broker: true },
  });
  if (!account) throw new Error("Broker account not found.");

  const connection = account.connections.find((c) => c.connectionType === "API_OAUTH");
  if (!connection || connection.status !== "ACTIVE" || !connection.accessTokenEncrypted) {
    throw new Error("This broker account isn't connected yet. Connect it first.");
  }
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    await prisma.brokerConnection.update({ where: { id: connection.id }, data: { status: "EXPIRED" } });
    throw new Error("Your broker session has expired (broker API tokens expire daily). Reconnect to sync again.");
  }

  const resolved = resolveConnector(account.broker.code);
  const accessToken = decryptToken(connection.accessTokenEncrypted);
  const session = connection.refreshTokenEncrypted
    ? (JSON.parse(decryptToken(connection.refreshTokenEncrypted)) as Record<string, string>)
    : undefined;

  let trades: CanonicalExecutionRow[];
  let holdings: CanonicalHoldingRow[];
  if (resolved.kind === "redirect") {
    [trades, holdings] = await Promise.all([
      resolved.connector.fetchTodaysTrades(accessToken),
      resolved.connector.fetchHoldings(accessToken),
    ]);
  } else {
    // Angel One/Kotak: fold the user's own encrypted API key back into the
    // session bag passed to the connector, so a later sync doesn't need to
    // ask them to re-enter it — only login() (the form submission itself)
    // gets it directly from `credentials`.
    const apiKey = connection.apiKeyEncrypted ? decryptToken(connection.apiKeyEncrypted) : undefined;
    const sessionWithApiKey = apiKey ? { ...(session ?? {}), apiKey } : session;
    [trades, holdings] = await Promise.all([
      resolved.connector.fetchTodaysTrades(accessToken, sessionWithApiKey),
      resolved.connector.fetchHoldings(accessToken, sessionWithApiKey),
    ]);
  }

  const importJob = await prisma.importJob.create({
    data: {
      userId,
      brokerAccountId,
      broker: account.brokerId,
      reportType: "API_SYNC",
      status: "PARSING",
      startedAt: new Date(),
      parserVersion: `${account.broker.code.toLowerCase()}-live-v1`,
    },
  });

  let tradesImported = 0;
  let duplicateTrades = 0;
  const touchedInstrumentIds = new Set<string>();

  for (const [index, row] of trades.entries()) {
    const result = await persistExecutionIfNew(brokerAccountId, row);
    if (result.status === "DUPLICATE") {
      duplicateTrades++;
      await prisma.importRow.create({
        data: {
          importJobId: importJob.id,
          rowNumber: index + 1,
          rawData: row.raw,
          status: "DUPLICATE",
          fingerprint: result.fingerprint,
          isDuplicate: true,
        },
      });
      continue;
    }
    tradesImported++;
    if (result.instrumentId) touchedInstrumentIds.add(result.instrumentId);
    await prisma.importRow.create({
      data: {
        importJobId: importJob.id,
        rowNumber: index + 1,
        rawData: row.raw,
        status: "IMPORTED",
        fingerprint: result.fingerprint,
        executionId: result.executionId,
      },
    });
  }

  const tradesGenerated = await regenerateTradesForInstruments(
    userId,
    brokerAccountId,
    Array.from(touchedInstrumentIds)
  );

  // No natural unique constraint on (brokerAccountId, instrumentId) yet —
  // find-then-write rather than Prisma upsert, matching the
  // "illustrative, not fully wired" scope of the Holdings page. Live sync
  // intentionally keeps this simple.
  // Fetched once and reused for every holding's fuzzy-match fallback below
  // (was previously one query per holding). Also temporarily logged in
  // full — need to see whether the expected CSV-imported instruments
  // (WIPRO, IDFCFIRSTB, ...) are even in this account-scoped pool at all,
  // since several that should match per matchEquityInstrumentByName's own
  // test coverage aren't.
  const equityCandidates = await prisma.instrument.findMany({
    where: { segment: "EQUITY", executions: { some: { brokerAccountId } } },
    include: { exchange: true },
  });

  let holdingsSynced = 0;
  const unmatchedHoldings: { symbol: string; exchange: string }[] = [];
  const ambiguousHoldings: { symbol: string; exchange: string; candidates: string[] }[] = [];
  for (const holding of holdings) {
    let instrument = await prisma.instrument.findFirst({
      where: { symbol: holding.symbol, exchange: { code: holding.exchange } },
    });
    // Exact match fails for Angel One specifically (see
    // matchEquityInstrumentByName's doc comment) — try the bounded,
    // never-guess fallback before giving up on this holding. Scoped to the
    // same exchange as the live holding — the same company can legitimately
    // have separate NSE and BSE instrument rows, which otherwise reads as a
    // false ambiguous-match and gets skipped for no real reason.
    const sameExchangeCandidates = equityCandidates.filter((c) => c.exchange.code === holding.exchange);
    if (!instrument) instrument = matchEquityInstrumentByName(sameExchangeCandidates, holding.symbol);
    if (!instrument) {
      unmatchedHoldings.push({ symbol: holding.symbol, exchange: holding.exchange });
      // A genuinely ambiguous case (2+ same-exchange candidates both prefix-
      // matching) is usually a real data problem — e.g. the same stock's
      // trade history fragmented across a truncated-symbol duplicate row
      // from an earlier import — not two different real stocks. Surfacing
      // which candidates collided, rather than just "unmatched", so it can
      // be diagnosed instead of silently skipped forever.
      const normalizedLive = holding.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const collided = sameExchangeCandidates.filter((c) => {
        const normalizedCsv = c.symbol
          .toUpperCase()
          .replace(/\b(LIMITED|LTD\.?|PRIVATE|PVT\.?)\b/g, "")
          .replace(/[^A-Z0-9]/g, "");
        return normalizedCsv.length > 0 && (normalizedCsv.startsWith(normalizedLive) || normalizedLive.startsWith(normalizedCsv));
      });
      if (collided.length > 1) {
        ambiguousHoldings.push({ symbol: holding.symbol, exchange: holding.exchange, candidates: collided.map((c) => c.symbol) });
      }
      continue; // resolved next sync once an execution creates it
    }

    const existingHolding = await prisma.holding.findFirst({ where: { brokerAccountId, instrumentId: instrument.id } });
    if (existingHolding) {
      await prisma.holding.update({
        where: { id: existingHolding.id },
        data: {
          quantity: holding.quantity,
          avgCostPrice: holding.avgCostPrice,
          currentPrice: holding.lastPrice,
          previousClose: holding.previousClose,
        },
      });
    } else {
      await prisma.holding.create({
        data: {
          userId,
          brokerAccountId,
          instrumentId: instrument.id,
          quantity: holding.quantity,
          avgCostPrice: holding.avgCostPrice,
          currentPrice: holding.lastPrice,
          previousClose: holding.previousClose,
        },
      });
    }
    holdingsSynced++;
  }

  if (unmatchedHoldings.length > 0) {
    // Temporary diagnostic: the live API returned more holdings than we
    // could attach to an existing instrument, even after the fuzzy-name
    // fallback. Logging exactly which ones, so a real mismatch pattern
    // (wrong exchange code, a symbol shape the matcher doesn't handle, an
    // instrument that was never CSV-imported at all) can be diagnosed from
    // Railway logs instead of guessed at.
    console.warn(
      `[broker-connect] ${unmatchedHoldings.length}/${holdings.length} live holdings for account ${brokerAccountId} had no matching instrument:`,
      unmatchedHoldings
    );
  }
  if (ambiguousHoldings.length > 0) {
    // These specifically collided between 2+ same-exchange candidates —
    // usually means that stock's trade history is already fragmented across
    // duplicate Instrument rows (e.g. a truncated-symbol import artifact),
    // not two genuinely different stocks. Real data problem, not a matcher
    // bug — surfaced so it can be reconciled deliberately, not auto-merged.
    console.warn(`[broker-connect] ${ambiguousHoldings.length} holdings collided between multiple candidates:`, ambiguousHoldings);
  }

  await prisma.importJob.update({
    where: { id: importJob.id },
    data: {
      status: "COMPLETED",
      totalRows: trades.length,
      validRows: tradesImported,
      duplicateRows: duplicateTrades,
      tradesGenerated,
      completedAt: new Date(),
    },
  });

  await prisma.brokerConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "BROKER_LIVE_SYNC_COMPLETED",
      entityType: "BrokerAccount",
      entityId: brokerAccountId,
      metadata: { tradesFetched: trades.length, tradesImported, duplicateTrades, holdingsSynced, tradesGenerated },
    },
  });

  return { tradesFetched: trades.length, tradesImported, duplicateTrades, holdingsSynced, tradesGenerated };
}
