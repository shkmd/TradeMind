import { createHash } from "crypto";
import type { BrokerApiConnector, CanonicalHoldingRow, ExchangedToken } from "../../api-connector";
import type { CanonicalExecutionRow } from "../../adapter";

/**
 * Zerodha Kite Connect v3 client. Endpoint paths, header names and the
 * checksum algorithm are taken directly from Zerodha's official
 * kiteconnectjs SDK source (github.com/zerodha/kiteconnectjs), not
 * guessed — see constants/index.ts and lib/connect.ts in that repo.
 *
 * Kite Connect requires its own paid developer API key/secret
 * (developers.kite.trade), separate from a regular trading account. This
 * connector only registers as "configured" when KITE_API_KEY/KITE_API_SECRET
 * are set, mirroring how the Google OAuth provider is conditional.
 */
const KITE_ROOT = "https://api.kite.trade";
const KITE_LOGIN_URL = "https://kite.zerodha.com/connect/login";
const KITE_VERSION = "3";

function getRedirectUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/broker-connect/zerodha/callback`;
}

function checksum(apiKey: string, requestToken: string, apiSecret: string): string {
  return createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");
}

async function kiteRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; accessToken?: string; body?: Record<string, string> } = {}
): Promise<T> {
  const apiKey = process.env.KITE_API_KEY;
  if (!apiKey) throw new Error("KITE_API_KEY is not configured.");

  const headers: Record<string, string> = {
    "X-Kite-Version": KITE_VERSION,
  };
  if (options.accessToken) {
    headers.Authorization = `token ${apiKey}:${options.accessToken}`;
  }

  const url = `${KITE_ROOT}${path}`;
  let body: string | undefined;
  if (options.method === "POST" && options.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.body).toString();
  }

  const response = await fetch(url, { method: options.method ?? "GET", headers, body });
  const json = await response.json();

  if (!response.ok || json.status === "error") {
    throw new Error(`Kite Connect error (${json.error_type ?? response.status}): ${json.message ?? response.statusText}`);
  }

  return json.data as T;
}

interface KiteTradeRecord {
  trade_id: string;
  order_id: string;
  exchange: string;
  tradingsymbol: string;
  transaction_type: "BUY" | "SELL";
  product: string;
  average_price: number;
  quantity: number;
  fill_timestamp: string;
}

interface KiteHoldingRecord {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  average_price: number;
  last_price: number;
}

interface KiteSessionResponse {
  access_token: string;
  user_id: string;
  user_name: string;
}

export const kiteConnectConnector: BrokerApiConnector = {
  brokerCode: "ZERODHA",

  isConfigured(): boolean {
    return Boolean(process.env.KITE_API_KEY && process.env.KITE_API_SECRET);
  },

  async buildLoginUrl(state: string): Promise<string> {
    const apiKey = process.env.KITE_API_KEY;
    if (!apiKey) throw new Error("KITE_API_KEY is not configured.");
    const params = new URLSearchParams({ api_key: apiKey, v: KITE_VERSION });
    // Kite passes the request_token back on our redirect URL, which we've
    // registered as /api/broker-connect/zerodha/callback; `state` (the
    // BrokerConnection id) rides along via a short-lived signed cookie set
    // right before this redirect, since Kite doesn't forward arbitrary state.
    void state;
    return `${KITE_LOGIN_URL}?${params.toString()}`;
  },

  async exchangeRequestToken(requestToken: string): Promise<ExchangedToken> {
    const apiKey = process.env.KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("Kite Connect is not configured.");

    const data = await kiteRequest<KiteSessionResponse>("/session/token", {
      method: "POST",
      body: {
        api_key: apiKey,
        request_token: requestToken,
        checksum: checksum(apiKey, requestToken, apiSecret),
      },
    });

    // Kite access tokens expire at ~6am IST the next calendar day
    // (regulatory requirement), regardless of when they were issued.
    const expiresAt = new Date();
    expiresAt.setUTCHours(24 + 0, 30, 0, 0); // 6:00 IST == 00:30 UTC, next day
    if (expiresAt.getTime() < Date.now()) expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

    return {
      accessToken: data.access_token,
      expiresAt,
      brokerUserId: data.user_id,
      brokerUserName: data.user_name,
    };
  },

  async fetchTodaysTrades(accessToken: string): Promise<CanonicalExecutionRow[]> {
    const trades = await kiteRequest<KiteTradeRecord[]>("/trades", { accessToken });
    return trades.map((t) => ({
      symbol: t.tradingsymbol,
      isin: null, // not included in the /trades response
      exchange: t.exchange,
      segment: "EQ",
      series: null,
      side: t.transaction_type,
      quantity: t.quantity,
      price: t.average_price,
      brokerTradeId: t.trade_id,
      brokerOrderId: t.order_id,
      executedAt: new Date(t.fill_timestamp),
      raw: t as unknown as Record<string, string>,
    }));
  },

  async fetchHoldings(accessToken: string): Promise<CanonicalHoldingRow[]> {
    const holdings = await kiteRequest<KiteHoldingRecord[]>("/portfolio/holdings", { accessToken });
    return holdings.map((h) => ({
      symbol: h.tradingsymbol,
      isin: h.isin || null,
      exchange: h.exchange,
      quantity: h.quantity,
      avgCostPrice: h.average_price,
      lastPrice: h.last_price ?? null,
      previousClose: null, // Kite Connect's holdings response doesn't include a previous-close field
    }));
  },
};

export { getRedirectUrl };
