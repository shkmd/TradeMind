import type Decimal from "decimal.js";
import type { ChargeBreakdown, ChargeInput } from "./types";
import { calculateRegulatoryCharges, GST_RATE, type RegulatoryCharges } from "./regulatory";
import { getBrokerageFormula } from "./brokerage-formulas";

/**
 * Combines regulatory charges (already computed) with a brokerage amount
 * into the final breakdown, including GST and totalCharges. Split out from
 * calculateCharges so callers that need to attribute a broker's per-ORDER
 * brokerage across multiple legs/trades (see execution-ingest.ts) can supply
 * that pre-computed share directly, rather than getting a fresh per-leg
 * brokerage figure that would double-count a flat per-order fee.
 */
export function composeChargeBreakdown(regulatory: RegulatoryCharges, brokerage: Decimal): ChargeBreakdown {
  const { turnover, sttCtt, exchangeTxnCharge, sebiCharges, stampDuty } = regulatory;
  const gst = brokerage.plus(exchangeTxnCharge).plus(sebiCharges).times(GST_RATE);
  const totalCharges = brokerage.plus(sttCtt).plus(exchangeTxnCharge).plus(sebiCharges).plus(stampDuty).plus(gst);
  return { turnover, brokerage, sttCtt, exchangeTxnCharge, sebiCharges, stampDuty, gst, totalCharges };
}

/**
 * Computes the full charge breakdown for one executed leg (equity or F&O) in
 * isolation, for any supported broker: regulatory charges (STT/CTT, exchange
 * txn, SEBI, stamp duty) plus that broker's own brokerage formula applied to
 * this leg's own turnover. Suitable for a single standalone leg; the real
 * import pipeline (execution-ingest.ts) does NOT call this directly for
 * multi-leg trades — it attributes brokerage at the order level instead,
 * since brokers charge a flat/capped fee per ORDER, not per FIFO-matched
 * leg, and an order split across legs would otherwise be charged brokerage
 * multiple times.
 */
export function calculateCharges(brokerCode: string, input: ChargeInput): ChargeBreakdown {
  const regulatory = calculateRegulatoryCharges(input);
  const segment = input.segment ?? "EQUITY";
  const brokerage = getBrokerageFormula(brokerCode)(regulatory.turnover, input.productType, segment);
  return composeChargeBreakdown(regulatory, brokerage);
}

/** Thin equity-only wrapper, preserved for existing callers/tests. */
export function calculateEquityCharges(brokerCode: string, input: ChargeInput): ChargeBreakdown {
  return calculateCharges(brokerCode, { ...input, segment: "EQUITY" });
}
