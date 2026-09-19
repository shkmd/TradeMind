import type { ChargeBreakdown, ChargeInput } from "./types";
import { calculateEquityCharges } from "./multi-broker-equity";

/**
 * Thin, broker-pinned wrapper over the shared multi-broker engine (see
 * multi-broker-equity.ts + brokerage-formulas.ts + regulatory.ts) — kept
 * as its own named export since it's the original/most-tested entry point
 * and other code (and tests) already call it directly for Zerodha.
 */
export function calculateZerodhaEquityCharges(input: ChargeInput): ChargeBreakdown {
  return calculateEquityCharges("ZERODHA", input);
}
