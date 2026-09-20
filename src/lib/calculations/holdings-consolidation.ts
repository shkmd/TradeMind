export interface ConsolidatableHolding {
  id: string;
  instrumentId: string;
  isin: string | null;
  quantity: number;
  avgCostPrice: number;
  currentPrice: number | null;
}

export interface HoldingGroup<T> {
  groupKey: string;
  legs: T[];
  totalQuantity: number;
  weightedAvgCost: number;
  currentValue: number | null;
  unrealised: number | null;
  unrealisedPct: number | null;
}

/**
 * Groups holdings by ISIN — the only reliable cross-broker identifier
 * available (different brokers spell the same real security's symbol
 * differently, e.g. Angel One's CSV "SUZLON ENERGY LIMITED" vs Dhan's bare
 * "SUZLON" ticker). When ISIN is missing (Angel One's CSV export never
 * includes one; Kotak's live sync doesn't either), falls back to grouping
 * by instrumentId instead of leaving every leg standalone — two holdings
 * that already resolved to the exact same Instrument row are not a guess,
 * they're a match the app's own instrument-resolution logic already made
 * (e.g. two broker accounts' live syncs both matching an existing
 * CSV-imported instrument by fuzzy name). Only when both ISIN and
 * instrumentId differ does a holding stay in its own group — never
 * guess-merge on symbol text alone, same discipline as
 * matchEquityInstrumentByName in instrument.service.ts.
 *
 * weightedAvgCost is Σ(qty×avgCost)/Σqty across the group's legs — the
 * correct way to combine cost basis, not a plain average of each leg's
 * avgCostPrice. currentValue/unrealised/unrealisedPct are computed only
 * over legs with a known currentPrice (never fabricate a price for an
 * unpriced leg), while totalQuantity always counts every leg regardless —
 * the same split the page's own KPI cards already apply one level up.
 */
export function consolidateByIsin<T extends ConsolidatableHolding>(rows: T[]): HoldingGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.isin && row.isin.trim() !== "" ? `isin:${row.isin}` : `instrument:${row.instrumentId}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  return Array.from(groups.entries()).map(([groupKey, legs]) => {
    const totalQuantity = legs.reduce((sum, leg) => sum + leg.quantity, 0);
    const totalCost = legs.reduce((sum, leg) => sum + leg.quantity * leg.avgCostPrice, 0);
    const weightedAvgCost = totalQuantity !== 0 ? totalCost / totalQuantity : 0;

    const pricedLegs = legs.filter((leg) => leg.currentPrice !== null);
    const currentValue =
      pricedLegs.length > 0 ? pricedLegs.reduce((sum, leg) => sum + leg.currentPrice! * leg.quantity, 0) : null;
    const pricedInvested =
      pricedLegs.length > 0 ? pricedLegs.reduce((sum, leg) => sum + leg.avgCostPrice * leg.quantity, 0) : null;
    const unrealised = currentValue !== null && pricedInvested !== null ? currentValue - pricedInvested : null;
    const unrealisedPct =
      unrealised !== null && pricedInvested !== null && pricedInvested !== 0 ? (unrealised / pricedInvested) * 100 : null;

    return { groupKey, legs, totalQuantity, weightedAvgCost, currentValue, unrealised, unrealisedPct };
  });
}
