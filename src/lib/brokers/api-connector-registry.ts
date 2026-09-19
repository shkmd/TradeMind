import type { BrokerApiConnector, BrokerDirectLoginConnector } from "./api-connector";
import { kiteConnectConnector } from "./zerodha/live/kite-connect";
import { dhanConnector } from "./dhan/live/dhan-connect";
import { upstoxConnector } from "./upstox/live/upstox-connect";
import { angelOneConnector } from "./angel-one/live/angel-connect";
import { kotakConnector } from "./kotak/live/kotak-connect";

/**
 * Redirect-login connectors — Zerodha, Dhan, Upstox — none of these ever
 * see a password.
 */
export const API_CONNECTOR_REGISTRY: Record<string, BrokerApiConnector | null> = {
  ZERODHA: kiteConnectConnector,
  DHAN: dhanConnector,
  UPSTOX: upstoxConnector,
  ANGEL_ONE: null,
  KOTAK: null,
  FYERS: null,
  GROWW: null,
};

export function getApiConnector(brokerCode: string): BrokerApiConnector | null {
  return API_CONNECTOR_REGISTRY[brokerCode] ?? null;
}

/**
 * Direct-login connectors — Angel One, Kotak — take a password/TOTP/MPIN
 * directly (no redirect login exists for their trading APIs). See the
 * warning on BrokerDirectLoginConnector in api-connector.ts.
 */
export const DIRECT_LOGIN_CONNECTOR_REGISTRY: Record<string, BrokerDirectLoginConnector | null> = {
  ANGEL_ONE: angelOneConnector,
  KOTAK: kotakConnector,
};

export function getDirectLoginConnector(brokerCode: string): BrokerDirectLoginConnector | null {
  return DIRECT_LOGIN_CONNECTOR_REGISTRY[brokerCode] ?? null;
}
