import type { BrokerApiConnector, CanonicalHoldingRow, ExchangedToken } from "../../api-connector";
import type { CanonicalExecutionRow } from "../../adapter";

/**
 * Upstox live API v2. Endpoints, OAuth2 flow and header format verified
 * directly against the official upstox/upstox-nodejs SDK source
 * (github.com/upstox/upstox-nodejs — src/ApiClient.js for the base URL and
 * Authorization header, src/api/LoginApi.js's examples for the
 * authorization_code grant, src/api/PostTradeApi.js for the historical
 * trades endpoint). Standard OAuth2 authorization_code redirect — the user
 * authenticates on Upstox's own site, we only ever receive a one-time
 * code — no password touches this app. Free, self-service developer app
 * registration at account.upstox.com/developer/apps (no paid subscription,
 * unlike Kite Connect).
 *
 * Notably better than Kite Connect for backfill: /v2/charges/historical-trades
 * accepts a date range, not just "today".
 */
const UPSTOX_ROOT = "https://api.upstox.com";
const UPSTOX_AUTHORIZE_URL = "https://api.upstox.com/v2/login/authorization/dialog";

function getRedirectUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/broker-connect/upstox/callback`;
}

async function upstoxRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; accessToken?: string; body?: Record<string, string> } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  const url = `${UPSTOX_ROOT}${path}`;
  let body: string | undefined;
  if (options.method === "POST" && options.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.body).toString();
  }

  const response = await fetch(url, { method: options.method ?? "GET", headers, body });
  const json = await response.json();
  if (!response.ok || json.status === "error") {
    const message = json.errors?.[0]?.message ?? json.message ?? response.statusText;
    throw new Error(`Upstox API error (${response.status}): ${message}`);
  }
  return (json.data ?? json) as T;
}

interface UpstoxTokenResponse {
  access_token: string;
  user_id: string;
  user_name?: string;
  // Upstox access tokens expire at end of trading day; the token response
  // itself doesn't include an explicit expiry field in the verified SDK
  // example, so this connector applies the same "expires at ~6am IST next
  // day" convention used for Kite Connect (also a SEBI-driven daily-expiry
  // regime for broker API tokens).
}
interface UpstoxTradeRecord {
  exchange: string;
  segment: string;
  quantity: number;
  trade_id: string;
  trade_date: string;
  transaction_type: "BUY" | "SELL";
  scrip_name: string;
  price: number;
  isin?: string;
  symbol: string;
}
interface UpstoxHoldingRecord {
  isin: string;
  product?: string;
  quantity: number;
  tradingsymbol?: string;
  trading_symbol?: string;
  last_price?: number;
  average_price: number;
  exchange: string;
}

export const upstoxConnector: BrokerApiConnector = {
  brokerCode: "UPSTOX",

  isConfigured(): boolean {
    return Boolean(process.env.UPSTOX_CLIENT_ID && process.env.UPSTOX_CLIENT_SECRET);
  },

  async buildLoginUrl(): Promise<string> {
    const clientId = process.env.UPSTOX_CLIENT_ID;
    if (!clientId) throw new Error("UPSTOX_CLIENT_ID is not configured.");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: getRedirectUrl(),
    });
    return `${UPSTOX_AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeRequestToken(code: string): Promise<ExchangedToken> {
    const clientId = process.env.UPSTOX_CLIENT_ID;
    const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Upstox is not configured.");

    const data = await upstoxRequest<UpstoxTokenResponse>("/v2/login/authorization/token", {
      method: "POST",
      body: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUrl(),
        grant_type: "authorization_code",
      },
    });

    const expiresAt = new Date();
    expiresAt.setUTCHours(24 + 0, 30, 0, 0); // ~6:00 IST next day
    if (expiresAt.getTime() < Date.now()) expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

    return { accessToken: data.access_token, expiresAt, brokerUserId: data.user_id, brokerUserName: data.user_name };
  },

  async fetchTodaysTrades(accessToken: string): Promise<CanonicalExecutionRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams({
      start_date: today,
      end_date: today,
      page_number: "1",
      page_size: "500",
    });
    const data = await upstoxRequest<{ trades: UpstoxTradeRecord[] }>(
      `/v2/charges/historical-trades?${params.toString()}`,
      { accessToken }
    );
    return (data.trades ?? []).map((t) => ({
      symbol: t.symbol,
      isin: t.isin ?? null,
      exchange: t.exchange.toUpperCase(),
      segment: t.segment.toUpperCase(),
      series: null,
      side: t.transaction_type,
      quantity: t.quantity,
      price: t.price,
      brokerTradeId: t.trade_id,
      brokerOrderId: t.trade_id, // verified response has no separate order_id field
      executedAt: new Date(`${t.trade_date}${t.trade_date.includes(":") ? "" : "T00:00:00+05:30"}`),
      raw: t as unknown as Record<string, string>,
    }));
  },

  async fetchHoldings(accessToken: string): Promise<CanonicalHoldingRow[]> {
    const holdings = await upstoxRequest<UpstoxHoldingRecord[]>("/v2/portfolio/long-term-holdings", { accessToken });
    return holdings.map((h) => ({
      symbol: h.tradingsymbol ?? h.trading_symbol ?? "",
      isin: h.isin ?? null,
      exchange: h.exchange || "NSE",
      quantity: h.quantity,
      avgCostPrice: h.average_price,
      lastPrice: h.last_price ?? null,
    }));
  },
};
