import type { BrokerAdapter } from "./adapter";
import { zerodhaAdapter } from "./zerodha/tradebook-parser";
import { dhanAdapter } from "./dhan/csv-parser";
import { upstoxAdapter } from "./upstox/csv-parser";
import { angelOneAdapter } from "./angel-one/trades-and-charges-parser";
import { kotakAdapter } from "./kotak/csv-parser";

export const BROKER_REGISTRY: Record<string, BrokerAdapter | null> = {
  ZERODHA: zerodhaAdapter,
  DHAN: dhanAdapter,
  UPSTOX: upstoxAdapter,
  ANGEL_ONE: angelOneAdapter,
  KOTAK: kotakAdapter,
  // Adapter interface is stable; these plug in without a schema change.
  FYERS: null,
  GROWW: null,
  GENERIC_CSV: null,
};

export function getBrokerAdapter(brokerCode: string): BrokerAdapter | null {
  return BROKER_REGISTRY[brokerCode] ?? null;
}

export const SEED_BROKERS: { code: string; name: string; isImplemented: boolean }[] = [
  { code: "ZERODHA", name: "Zerodha", isImplemented: true },
  { code: "DHAN", name: "Dhan", isImplemented: true },
  { code: "UPSTOX", name: "Upstox", isImplemented: true },
  { code: "ANGEL_ONE", name: "Angel One", isImplemented: true },
  { code: "KOTAK", name: "Kotak Securities", isImplemented: true },
  { code: "FYERS", name: "Fyers", isImplemented: false },
  { code: "GROWW", name: "Groww", isImplemented: false },
  { code: "GENERIC_CSV", name: "Generic CSV/XLSX", isImplemented: false },
];
