import type { CanonicalExecutionRow } from "./adapter";

export interface CanonicalHoldingRow {
  symbol: string;
  isin: string | null;
  exchange: string;
  quantity: number;
  avgCostPrice: number;
  lastPrice: number | null;
  /** Prior trading day's close, for a Today's Gain figure. Not every broker's API provides this. */
  previousClose: number | null;
}

export interface ExchangedToken {
  accessToken: string;
  /** Kite Connect tokens expire at ~6am IST the next day; other brokers may differ. */
  expiresAt: Date;
  brokerUserId?: string;
  brokerUserName?: string;
  /**
   * Extra broker-specific session values beyond the single accessToken —
   * e.g. Kotak Neo requires both a `sid` and a `token` (Auth) header on
   * every request, and returns a dynamic per-account `baseUrl`. Stored
   * alongside accessToken (same encryption), passed back into
   * fetchTodaysTrades/fetchHoldings as the `session` param.
   */
  session?: Record<string, string>;
}

/**
 * Live, read-only broker API connection for brokers with a proper
 * browser-redirect login (Zerodha, Dhan, Upstox) — the user authenticates
 * on the broker's own site, we only ever receive a one-time code/token,
 * and no password/PIN/TOTP ever touches this app.
 *
 * Angel One and Kotak Securities don't offer a redirect login for their
 * trading APIs — they require the app itself to submit a password/TOTP
 * (Angel One) or mobile+TOTP+MPIN (Kotak) directly to the broker's API.
 * That's a materially different trust boundary, so it's a separate
 * interface (BrokerDirectLoginConnector, below) rather than forced into
 * this one — never store those credentials; forward them to the broker
 * and discard immediately, keeping only the resulting session token.
 */
export interface BrokerApiConnector {
  brokerCode: string;

  /** True once the required API key/secret env vars are present. */
  isConfigured(): boolean;

  /**
   * URL to redirect the user to for the broker's own login page. Async
   * because some brokers (Dhan) require a server-side call — using their
   * app_secret, which must never reach the browser — to obtain a
   * short-lived consent id before the real login URL is known; others
   * (Zerodha, Upstox) can build it synchronously and just resolve immediately.
   */
  buildLoginUrl(state: string): Promise<string>;

  /** Exchanges the one-time request token (from the login redirect) for an access token. */
  exchangeRequestToken(requestToken: string): Promise<ExchangedToken>;

  /**
   * Today's executed fills only — Kite Connect (and most broker live APIs)
   * expose only the current trading day's trade book via the live API;
   * historical backfill is what the CSV Tradebook import is for.
   */
  fetchTodaysTrades(accessToken: string): Promise<CanonicalExecutionRow[]>;

  fetchHoldings(accessToken: string): Promise<CanonicalHoldingRow[]>;
}

/**
 * For brokers whose live trading API has no redirect-login option (Angel
 * One, Kotak Securities) — the app must submit credentials directly to the
 * broker's own API. This is the pattern the rest of this app's security
 * model exists to avoid; it's implemented only because the user explicitly
 * asked for these two brokers with full knowledge of the tradeoff (see the
 * comment above BrokerApiConnector). The credentials type is intentionally
 * a loose Record — Angel One's shape (clientCode/password/totp) and
 * Kotak's two-phase shape (mobileNumber/ucc/totp, then mpin) don't share a
 * common field set.
 *
 * HARD RULE: nothing implementing this interface may persist the raw
 * credentials object anywhere (DB, logs, audit trail) — only the resulting
 * ExchangedToken.accessToken gets encrypted and stored.
 */
export interface BrokerDirectLoginConnector {
  brokerCode: string;
  isConfigured(): boolean;
  login(credentials: Record<string, string>): Promise<ExchangedToken>;
  fetchTodaysTrades(accessToken: string, session?: Record<string, string>): Promise<CanonicalExecutionRow[]>;
  fetchHoldings(accessToken: string, session?: Record<string, string>): Promise<CanonicalHoldingRow[]>;
}
