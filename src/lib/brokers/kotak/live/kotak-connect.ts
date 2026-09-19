import type { BrokerDirectLoginConnector, CanonicalHoldingRow, ExchangedToken } from "../../api-connector";
import type { CanonicalExecutionRow } from "../../adapter";

/**
 * Kotak Neo Trade API. Endpoints, headers and the 2-step totp_login ->
 * totp_validate flow verified directly against the official, actively
 * maintained Kotak-Neo/kotak-neo-python SDK source (neo_api_client/
 * services/totp.py, trade_report.py, portfolio.py) — not guessed. Sample
 * trade_report/holdings responses verified against real JSON examples in
 * Kotak-Neo/Kotak-neo-api-v2's official docs.
 *
 * Like Angel One, Kotak Neo has no redirect login for its trading API —
 * step 1 takes mobile number + TOTP directly, step 2 takes the trading
 * MPIN directly. Neither is ever stored: login() takes both in one call,
 * forwards them to Kotak's API, and returns only the resulting session
 * token (which itself is a *pair* of values — sid + token — carried in
 * ExchangedToken.session, since Kotak's API requires both on every
 * subsequent request, not a single bearer token).
 */
const KOTAK_DEFAULT_BASE_URL = "https://mis.kotaksecurities.com";
const NEO_FIN_KEY = "neotradeapi"; // Kotak SDK's own default when none is configured — not a secret.

async function kotakRequest<T>(
  baseUrl: string,
  path: string,
  options: { method?: "GET" | "POST"; headers: Record<string, string>; body?: Record<string, string> }
): Promise<T> {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: options.method ?? "GET",
    headers: { ...options.headers, ...(options.body ? { "Content-Type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Kotak Neo API error (${response.status}): ${json.errMsg ?? json.message ?? response.statusText}`);
  }
  return json as T;
}

interface KotakTotpLoginResponse {
  data?: { token: string; sid: string; ucc: string };
}
interface KotakTotpValidateResponse {
  data?: {
    token: string;
    sid: string;
    rid: string;
    dataCenter: string;
    baseUrl?: string;
    ucc: string;
  };
}
interface KotakTradeRecord {
  trdSym: string;
  sym: string;
  trnsTp: "B" | "S";
  fldQty: number;
  avgPrc: string;
  exSeg: string;
  flDt: string; // "22-Jan-2025"
  flTm: string; // "14:28:16"
  nOrdNo: string;
  exOrdId: string;
  flId: string;
}
interface KotakHoldingRecord {
  symbol: string;
  displaySymbol: string;
  averagePrice: number;
  quantity: number;
  exchangeSegment: string;
  closingPrice?: number;
}

function splitKotakSegment(raw: string): { exchange: string; segment: string } {
  const lower = (raw || "nse_cm").toLowerCase();
  const [exchange = "nse", segCode = "cm"] = lower.split("_");
  const map: Record<string, string> = { cm: "EQ", fo: "FUT", cd: "CUR" };
  return { exchange: exchange.toUpperCase(), segment: map[segCode] ?? segCode.toUpperCase() };
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseKotakDateTime(flDt: string, flTm: string): Date {
  const match = flDt.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return new Date(); // defensive fallback; Kotak's own format is well-established
  const [, day, monAbbr, year] = match;
  const month = MONTHS[monAbbr!.toLowerCase()] ?? "01";
  return new Date(`${year}-${month}-${day!.padStart(2, "0")}T${flTm || "00:00:00"}+05:30`);
}

export const kotakConnector: BrokerDirectLoginConnector = {
  brokerCode: "KOTAK",

  isConfigured(): boolean {
    return Boolean(process.env.KOTAK_CONSUMER_KEY);
  },

  /**
   * credentials: { mobileNumber, ucc, totp, mpin } — all four collected in
   * one form submission client-side (rather than the true 2-step API round
   * trip) to avoid holding an intermediate Kotak session token in browser
   * state; server-side this still makes both Kotak API calls in sequence.
   */
  async login(credentials: Record<string, string>): Promise<ExchangedToken> {
    const consumerKey = process.env.KOTAK_CONSUMER_KEY;
    if (!consumerKey) throw new Error("KOTAK_CONSUMER_KEY is not configured.");

    const { mobileNumber, ucc, totp, mpin } = credentials;
    if (!mobileNumber || !ucc || !totp || !mpin) {
      throw new Error("Mobile number, UCC, TOTP and MPIN are all required.");
    }

    const loginResponse = await kotakRequest<KotakTotpLoginResponse>(
      KOTAK_DEFAULT_BASE_URL,
      "login/1.0/tradeApiLogin",
      {
        method: "POST",
        headers: { Authorization: consumerKey, "neo-fin-key": NEO_FIN_KEY },
        body: { mobileNumber, ucc, totp },
      }
    );
    const viewToken = loginResponse.data?.token;
    const viewSid = loginResponse.data?.sid;
    if (!viewToken || !viewSid) {
      throw new Error("Kotak Neo login failed — check mobile number, UCC and TOTP.");
    }

    const validateResponse = await kotakRequest<KotakTotpValidateResponse>(
      KOTAK_DEFAULT_BASE_URL,
      "login/1.0/tradeApiValidate",
      {
        method: "POST",
        headers: { Authorization: consumerKey, sid: viewSid, Auth: viewToken, "neo-fin-key": NEO_FIN_KEY },
        body: { mpin },
      }
    );
    const editToken = validateResponse.data?.token;
    const editSid = validateResponse.data?.sid;
    if (!editToken || !editSid) {
      throw new Error("Kotak Neo MPIN validation failed.");
    }

    const expiresAt = new Date();
    expiresAt.setUTCHours(24 + 0, 30, 0, 0); // conservative end-of-day, matching Kite/Upstox convention
    if (expiresAt.getTime() < Date.now()) expiresAt.setUTCDate(expiresAt.getUTCDate() + 1);

    return {
      accessToken: editToken,
      expiresAt,
      brokerUserId: validateResponse.data?.ucc,
      session: {
        sid: editSid,
        baseUrl: validateResponse.data?.baseUrl || KOTAK_DEFAULT_BASE_URL,
      },
    };
  },

  async fetchTodaysTrades(accessToken: string, session?: Record<string, string>): Promise<CanonicalExecutionRow[]> {
    const consumerKey = process.env.KOTAK_CONSUMER_KEY;
    if (!consumerKey || !session?.sid) throw new Error("Kotak session is incomplete.");
    const baseUrl = session.baseUrl || KOTAK_DEFAULT_BASE_URL;

    const response = await kotakRequest<{ data: KotakTradeRecord[] }>(baseUrl, "quick/user/trades", {
      headers: { Sid: session.sid, Auth: accessToken, Accept: "application/json" },
    });

    return (response.data ?? []).map((t) => {
      const { exchange, segment } = splitKotakSegment(t.exSeg);
      return {
        symbol: (t.sym || t.trdSym).toUpperCase(),
        isin: null, // not present in the verified trade_report sample
        exchange,
        segment,
        series: null,
        side: t.trnsTp === "B" ? "BUY" : "SELL",
        quantity: Number(t.fldQty),
        price: Number(t.avgPrc),
        brokerTradeId: t.flId || t.exOrdId,
        brokerOrderId: t.nOrdNo,
        executedAt: parseKotakDateTime(t.flDt, t.flTm),
        raw: t as unknown as Record<string, string>,
      };
    });
  },

  async fetchHoldings(accessToken: string, session?: Record<string, string>): Promise<CanonicalHoldingRow[]> {
    const consumerKey = process.env.KOTAK_CONSUMER_KEY;
    if (!consumerKey || !session?.sid) throw new Error("Kotak session is incomplete.");
    const baseUrl = session.baseUrl || KOTAK_DEFAULT_BASE_URL;

    const response = await kotakRequest<{ data: KotakHoldingRecord[] }>(baseUrl, "portfolio/v1/holdings", {
      headers: { Sid: session.sid, Auth: accessToken, Accept: "application/json" },
    });

    return (response.data ?? []).map((h) => {
      const { exchange } = splitKotakSegment(h.exchangeSegment);
      return {
        symbol: (h.symbol || h.displaySymbol).toUpperCase(),
        isin: null, // not present in the verified holdings sample
        exchange,
        quantity: h.quantity,
        avgCostPrice: h.averagePrice,
        lastPrice: h.closingPrice ?? null,
      };
    });
  },
};
