import type { BrokerApiConnector, CanonicalHoldingRow, ExchangedToken } from "../../api-connector";
import type { CanonicalExecutionRow } from "../../adapter";

/**
 * DhanHQ live API. Endpoint paths and the 3-step consent-login flow are
 * taken from Dhan's official documentation (dhanhq.co/docs/v2/authentication)
 * and the official dhan-oss/DhanHQ-js SDK (github.com/dhan-oss/DhanHQ-js),
 * not guessed. A proper browser-redirect login — the user authenticates on
 * Dhan's own site, we only ever receive a one-time tokenId — so no
 * password ever touches this app, same guarantee as Zerodha's Kite Connect.
 *
 * Requires a free Dhan Partner API app (app_id/app_secret) registered at
 * Dhan's developer console — separate from the simpler "paste a
 * self-generated access token" option Dhan also offers, which this
 * connector doesn't use since it isn't a redirect flow.
 */
const DHAN_AUTH_ROOT = "https://auth.dhan.co";
const DHAN_API_ROOT = "https://api.dhan.co";

async function dhanAuthRequest<T>(path: string, options: { method?: "GET" | "POST" } = {}): Promise<T> {
  const appId = process.env.DHAN_APP_ID;
  const appSecret = process.env.DHAN_APP_SECRET;
  if (!appId || !appSecret) throw new Error("DHAN_APP_ID/DHAN_APP_SECRET are not configured.");

  const response = await fetch(`${DHAN_AUTH_ROOT}${path}`, {
    method: options.method ?? "GET",
    headers: { app_id: appId, app_secret: appSecret },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Dhan auth error (${response.status}): ${json.errorMessage ?? json.message ?? response.statusText}`);
  }
  return json as T;
}

async function dhanApiRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${DHAN_API_ROOT}${path}`, {
    headers: { "Content-Type": "application/json", "access-token": accessToken },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Dhan API error (${response.status}): ${json.errorMessage ?? json.message ?? response.statusText}`);
  }
  return json as T;
}

interface DhanConsentResponse {
  consentAppId: string;
}
interface DhanConsumeResponse {
  accessToken: string;
  dhanClientId: string;
  expiryTime: string;
}
interface DhanTradeRecord {
  dhanClientId: string;
  orderId: string;
  exchangeOrderId: string;
  exchangeTradeId: string;
  transactionType: "BUY" | "SELL";
  exchangeSegment: string;
  productType: string;
  tradingSymbol: string;
  securityId: string;
  tradedQuantity: number;
  tradedPrice: number;
  isin?: string;
  exchangeTime?: string;
  createTime?: string;
}
interface DhanHoldingRecord {
  tradingSymbol: string;
  isin?: string;
  exchange: string;
  totalQty: number;
  avgCostPrice: number;
  lastTradedPrice?: number;
}

function splitDhanSegment(raw: string): { exchange: string; segment: string } {
  const upper = (raw || "NSE_EQ").toUpperCase();
  const [exchange = "NSE", segCode = "EQ"] = upper.split("_");
  const map: Record<string, string> = { EQ: "EQ", FNO: "FUT", FO: "FUT", CURRENCY: "CUR" };
  return { exchange, segment: map[segCode] ?? segCode };
}

export const dhanConnector: BrokerApiConnector = {
  brokerCode: "DHAN",

  isConfigured(): boolean {
    return Boolean(process.env.DHAN_APP_ID && process.env.DHAN_APP_SECRET);
  },

  async buildLoginUrl(state: string): Promise<string> {
    // `state` (our BrokerConnection id) can't ride through Dhan's redirect
    // — the callback only ever returns a bare tokenId — so, same as Kite
    // Connect, the caller must stash it in a cookie before redirecting here.
    void state;
    const consentAppId = await generateDhanConsent();
    return buildDhanConsentLoginUrl(consentAppId);
  },

  async exchangeRequestToken(tokenId: string): Promise<ExchangedToken> {
    const data = await dhanAuthRequest<DhanConsumeResponse>(
      `/app/consumeApp-consent?tokenId=${encodeURIComponent(tokenId)}`,
      { method: "POST" }
    );
    return {
      accessToken: data.accessToken,
      expiresAt: new Date(data.expiryTime),
      brokerUserId: data.dhanClientId,
    };
  },

  async fetchTodaysTrades(accessToken: string): Promise<CanonicalExecutionRow[]> {
    const trades = await dhanApiRequest<DhanTradeRecord[]>("/trades", accessToken);
    return trades.map((t) => {
      const { exchange, segment } = splitDhanSegment(t.exchangeSegment);
      return {
        symbol: t.tradingSymbol,
        isin: t.isin ?? null,
        exchange,
        segment,
        series: null,
        side: t.transactionType,
        quantity: t.tradedQuantity,
        price: t.tradedPrice,
        brokerTradeId: t.exchangeTradeId,
        brokerOrderId: t.orderId,
        executedAt: new Date(t.exchangeTime ?? t.createTime ?? Date.now()),
        raw: t as unknown as Record<string, string>,
      };
    });
  },

  async fetchHoldings(accessToken: string): Promise<CanonicalHoldingRow[]> {
    const holdings = await dhanApiRequest<DhanHoldingRecord[]>("/holdings", accessToken);
    return holdings.map((h) => ({
      symbol: h.tradingSymbol,
      isin: h.isin ?? null,
      exchange: h.exchange || "NSE",
      quantity: h.totalQty,
      avgCostPrice: h.avgCostPrice,
      lastPrice: h.lastTradedPrice ?? null,
    }));
  },
};

/** Step 1 of Dhan's consent flow (used by dhanConnector.buildLoginUrl above). */
async function generateDhanConsent(): Promise<string> {
  const data = await dhanAuthRequest<DhanConsentResponse>("/app/generate-consent", { method: "POST" });
  return data.consentAppId;
}

function buildDhanConsentLoginUrl(consentAppId: string): string {
  return `${DHAN_AUTH_ROOT}/login/consentApp-login?consentAppId=${encodeURIComponent(consentAppId)}`;
}
