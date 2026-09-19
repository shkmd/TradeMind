import Decimal from "decimal.js";
import type { TradeProductType } from "@prisma/client";
import type { ChargeSegment } from "./types";

export type BrokerageFormula = (turnover: Decimal, productType: TradeProductType, segment: ChargeSegment) => Decimal;

/**
 * Each broker's publicly advertised discount-brokerage plan as of this
 * implementation — not independently verified against each broker's current
 * rate card the way the Kite Connect API integration was verified against
 * source code, and brokers change pricing without notice. Like the
 * regulatory rates in regulatory.ts, these are named constants that must
 * migrate to a versioned `ChargeRate` table in a later phase rather than
 * being trusted as exact for any date other than "now".
 */

const flatOrPercent = (turnover: Decimal, rate: Decimal, cap: Decimal): Decimal =>
  Decimal.min(turnover.times(rate), cap);

// Confirmed against real Angel One F&O data: flat ₹20/order regardless of
// productType/exchange/segment (options and futures, NSE/BSE/MCX alike).
// Computed per-LEG here (once per FIFO-matched trade leg), not per-ORDER —
// the broker's own per-row export shows this ₹20 concentrated on one fill
// row per order rather than spread across partial fills, which this
// per-leg engine doesn't replicate byte-for-byte (same simplification also
// shows up as small STT/stamp-duty deviations in regulatory.ts — see the
// comment there). Documented gap, not a wrong rate.
const ANGEL_ONE_FNO_FLAT_BROKERAGE = new Decimal(20);

// F&O brokerage for these four brokers is unverified — their adapters
// reject F&O rows at import, so this should be unreachable. Throwing rather
// than silently returning an equity-shaped number if that gate is ever
// bypassed matches this codebase's "never guess" discipline.
function unsupportedFnoBrokerage(brokerCode: string): never {
  throw new Error(`${brokerCode} F&O brokerage is not yet verified — F&O import is rejected upstream for this broker.`);
}

export const BROKERAGE_FORMULAS: Record<string, BrokerageFormula> = {
  // Zero delivery brokerage; intraday/F&O: 0.03% or ₹20/order, whichever lower.
  ZERODHA: (turnover, productType, segment) => {
    if (segment !== "EQUITY") return unsupportedFnoBrokerage("ZERODHA");
    return productType === "INTRADAY" ? flatOrPercent(turnover, new Decimal("0.0003"), new Decimal(20)) : new Decimal(0);
  },

  // Zero delivery brokerage; intraday/F&O: flat ₹20/order (or 0.03%, whichever lower).
  DHAN: (turnover, productType, segment) => {
    if (segment !== "EQUITY") return unsupportedFnoBrokerage("DHAN");
    return productType === "INTRADAY" ? flatOrPercent(turnover, new Decimal("0.0003"), new Decimal(20)) : new Decimal(0);
  },

  // Zero delivery brokerage; intraday/F&O: flat ₹20/order (or 0.05%, whichever lower).
  UPSTOX: (turnover, productType, segment) => {
    if (segment !== "EQUITY") return unsupportedFnoBrokerage("UPSTOX");
    return productType === "INTRADAY" ? flatOrPercent(turnover, new Decimal("0.0005"), new Decimal(20)) : new Decimal(0);
  },

  // Equity: zero delivery brokerage; intraday: flat ₹20/order (or 0.25%, whichever lower).
  // F&O: flat ₹20/order regardless of productType — calibrated against real data.
  ANGEL_ONE: (turnover, productType, segment) => {
    if (segment === "EQUITY") {
      return productType === "INTRADAY" ? flatOrPercent(turnover, new Decimal("0.0025"), new Decimal(20)) : new Decimal(0);
    }
    return ANGEL_ONE_FNO_FLAT_BROKERAGE;
  },

  // Kotak Securities is a full-service broker, not flat-fee — percentage-based on
  // both delivery and intraday. Plans vary considerably (Trade Free Youth vs
  // standard); this uses a representative mid-range estimate, flagged as the
  // least-confident number in this file. No free-delivery assumption applies.
  KOTAK: (turnover, productType, segment) => {
    if (segment !== "EQUITY") return unsupportedFnoBrokerage("KOTAK");
    return productType === "INTRADAY" ? turnover.times("0.0020") : turnover.times("0.0050");
  },
};

export function getBrokerageFormula(brokerCode: string): BrokerageFormula {
  return BROKERAGE_FORMULAS[brokerCode] ?? BROKERAGE_FORMULAS.ZERODHA!;
}
