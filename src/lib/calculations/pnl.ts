import Decimal from "decimal.js";
import type { TradeSide } from "@prisma/client";

/**
 * Realized P&L for one matched lot (a portion of an entry matched against a
 * portion of an exit during FIFO grouping). Computed at the lot level, not
 * from averaged entry/exit prices, so partial fills at very different
 * prices stay correct.
 */
export function computeLotPnl(
  entryPrice: Decimal,
  exitPrice: Decimal,
  quantity: Decimal,
  side: TradeSide
): Decimal {
  const diff = exitPrice.minus(entryPrice);
  const signed = side === "BUY" ? diff : diff.negated();
  return signed.times(quantity);
}

/** Sums per-lot P&L into a trade's gross realized P&L. */
export function sumGrossPnl(lotPnls: Decimal[]): Decimal {
  return lotPnls.reduce((sum, pnl) => sum.plus(pnl), new Decimal(0));
}

/** Net P&L after all charges — the reconciliation identity the app relies on. */
export function computeNetPnl(grossPnl: Decimal, totalCharges: Decimal): Decimal {
  return grossPnl.minus(totalCharges);
}
