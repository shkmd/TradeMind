import type { BrokerApiConnector, BrokerDirectLoginConnector } from "./api-connector";
import { kiteConnectConnector } from "./zerodha/live/kite-connect";
import { dhanConnector } from "./dhan/live/dhan-connect";
import { upstoxConnector } from "./upstox/live/upstox-connect";
import { angelOneConnector } from "./angel-one/live/angel-connect";
import { kotakConnector } from "./kotak/live/kotak-connect";

/**
 * Redirect-login connectors — Zerodha only — one platform-owned developer
 * app that many users authenticate through via a normal OAuth redirect;
 * none of these ever see a password.
 */
export const API_CONNECTOR_REGISTRY: Record<string, BrokerApiConnector | null> = {
  ZERODHA: kiteConnectConnector,
  UPSTOX: null,
  ANGEL_ONE: null,
  KOTAK: null,
  DHAN: null,
  FYERS: null,
  GROWW: null,
};

export function getApiConnector(brokerCode: string): BrokerApiConnector | null {
  return API_CONNECTOR_REGISTRY[brokerCode] ?? null;
}

/**
 * Direct-login connectors — Angel One, Kotak, Dhan, Upstox — each user
 * brings their own personal credential (password/TOTP/MPIN, or a
 * self-generated access token for Dhan/Upstox) directly, no redirect login
 * or platform-owned app involved. See the warning on
 * BrokerDirectLoginConnector in api-connector.ts.
 */
export const DIRECT_LOGIN_CONNECTOR_REGISTRY: Record<string, BrokerDirectLoginConnector | null> = {
  ANGEL_ONE: angelOneConnector,
  KOTAK: kotakConnector,
  DHAN: dhanConnector,
  UPSTOX: upstoxConnector,
};

export function getDirectLoginConnector(brokerCode: string): BrokerDirectLoginConnector | null {
  return DIRECT_LOGIN_CONNECTOR_REGISTRY[brokerCode] ?? null;
}
