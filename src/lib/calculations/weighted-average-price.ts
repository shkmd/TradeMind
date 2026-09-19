import Decimal from "decimal.js";

export interface PriceLot {
  quantity: Decimal;
  price: Decimal;
}

/**
 * Σ(qty × price) / Σqty across a set of lots. Used to derive a Trade's
 * entryAvgPrice/exitAvgPrice for display once FIFO matching has determined
 * which executions belong to which trade.
 */
export function computeWeightedAveragePrice(lots: PriceLot[]): Decimal {
  const totalQuantity = lots.reduce((sum, lot) => sum.plus(lot.quantity), new Decimal(0));

  if (totalQuantity.isZero()) {
    throw new Error("computeWeightedAveragePrice: total quantity is zero");
  }

  const totalCost = lots.reduce((sum, lot) => sum.plus(lot.quantity.times(lot.price)), new Decimal(0));

  return totalCost.dividedBy(totalQuantity);
}
