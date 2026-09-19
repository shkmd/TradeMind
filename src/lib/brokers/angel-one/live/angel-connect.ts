import type { BrokerDirectLoginConnector, CanonicalHoldingRow, ExchangedToken } from "../../api-connector";
import type { CanonicalExecutionRow } from "../../adapter";

/**
 * Angel One SmartAPI. Endpoints and headers verified directly against the
 * official angel-one/smartapi-javascript SDK source (config/api.js for
 * routes, lib/smartapi-connect.js for headers) — not guessed. Sample
 * getTradeBook/getHolding responses verified against Angel One's own docs
 * (smartapi.angelbroking.com/docs/Orders).
 *
 * Unlike Zerodha/Dhan/Upstox, SmartAPI has NO redirect login for the
 * trading API — `generateSession` takes clientcode + password + totp
 * directly. This connector never stores that password/TOTP: `login()`
 * forwards it to Angel One's API in one call and returns only the
 * resulting JWT, which is what gets encrypted and persisted.
 */
const ANGEL_ROOT = "https://apiconnect.angelone.in";

async function angelRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; accessToken?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
  const apiKey = process.env.ANGEL_ONE_API_KEY;
  if (!apiKey) throw new Error("ANGEL_ONE_API_KEY is not configured.");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": apiKey,
    // Angel One's SDK sends the server's own local/public IP + MAC address
    // here; those are meaningful for a desktop app running on the trader's
    // machine, not for a server-side integration like this one. Sending
    // placeholder values matches how most server-side SmartAPI integrations
    // handle this (the values aren't validated against the actual caller).
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  const response = await fetch(`${ANGEL_ROOT}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  if (!response.ok || json.status === false) {
    throw new Error(`Angel One API error (${json.errorcode ?? response.status}): ${json.message ?? response.statusText}`);
  }
  return json.data as T;
}

interface AngelLoginResponse {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
}
interface AngelTradeRecord {
  exchange: string;
  producttype: string;
  tradingsymbol: string;
  transactiontype: "BUY" | "SELL";
  fillprice: string;
  fillsize: string;
  orderid: string;
  fillid: string;
  filltime: string; // time-of-day only — getTradeBook is today-only
}
interface AngelHoldingRecord {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  averageprice: number;
  ltp?: number;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const angelOneConnector: BrokerDirectLoginConnector = {
  brokerCode: "ANGEL_ONE",

  isConfigured(): boolean {
    return Boolean(process.env.ANGEL_ONE_API_KEY);
  },

  /** credentials: { clientCode, password, totp } — used once, never stored. */
  async login(credentials: Record<string, string>): Promise<ExchangedToken> {
    const { clientCode, password, totp } = credentials;
    if (!clientCode || !password || !totp) {
      throw new Error("Client code, password and TOTP are all required.");
    }

    const data = await angelRequest<AngelLoginResponse>("/rest/auth/angelbroking/user/v1/loginByPassword", {
      method: "POST",
      body: { clientcode: clientCode, password, totp },
    });

    // SmartAPI JWTs are short-lived (session-based, not a fixed daily
    // expiry like Kite/Upstox) — treated conservatively as end-of-day.
    const expiresAt = new Date();
    expiresAt.setUTCHours(24 + 0, 30, 0, 0);
    if (expiresAt.getTime() < Date.now()) expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

    return {
      accessToken: data.jwtToken,
      expiresAt,
      brokerUserId: clientCode,
      session: { refreshToken: data.refreshToken },
    };
  },

  async fetchTodaysTrades(accessToken: string): Promise<CanonicalExecutionRow[]> {
    const trades = await angelRequest<AngelTradeRecord[]>("/rest/secure/angelbroking/order/v1/getTradeBook", {
      accessToken,
    });
    const today = todayIsoDate();
    // SmartAPI tags F&O/commodity/currency fills with exchange codes like
    // NFO/BFO/MCX/CDS, distinct from NSE/BSE for equity. The CSV import path
    // parses F&O contract strings (see contract-parser.ts); this live-sync
    // path doesn't yet, and there's no per-row error UI for live sync the
    // way the import wizard has — so F&O fills are skipped here rather than
    // imported and silently mis-priced with equity charge formulas.
    const EQUITY_EXCHANGES = new Set(["NSE", "BSE"]);
    return (trades ?? [])
      .filter((t) => {
        const isEquity = EQUITY_EXCHANGES.has(t.exchange.toUpperCase());
        if (!isEquity) {
          console.warn(
            `[angel-connect] Skipping non-equity fill (exchange=${t.exchange}, symbol=${t.tradingsymbol}) — F&O/commodity/currency live sync isn't supported yet.`
          );
        }
        return isEquity;
      })
      .map((t) => ({
        symbol: t.tradingsymbol.replace(/-EQ$/, ""),
        isin: null, // not present in the verified getTradeBook response
        exchange: t.exchange.toUpperCase(),
        segment: "EQ",
        series: null,
        side: t.transactiontype,
        quantity: Number(t.fillsize),
        price: Number(t.fillprice),
        brokerTradeId: t.fillid,
        brokerOrderId: t.orderid,
        // getTradeBook only returns today's fills, and filltime is
        // time-of-day only (no date field) — combine with today's date.
        executedAt: new Date(`${today}T${t.filltime}+05:30`),
        raw: t as unknown as Record<string, string>,
      }));
  },

  async fetchHoldings(accessToken: string): Promise<CanonicalHoldingRow[]> {
    const holdings = await angelRequest<AngelHoldingRecord[]>("/rest/secure/angelbroking/portfolio/v1/getHolding", {
      accessToken,
    });
    return (holdings ?? []).map((h) => ({
      symbol: h.tradingsymbol.replace(/-EQ$/, ""),
      isin: h.isin || null,
      exchange: h.exchange || "NSE",
      quantity: h.quantity,
      avgCostPrice: h.averageprice,
      lastPrice: h.ltp ?? null,
    }));
  },
};
