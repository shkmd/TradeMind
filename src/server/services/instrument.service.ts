import { prisma } from "@/lib/db/prisma";
import type { Exchange, Instrument, InstrumentSegment, OptionType } from "@prisma/client";
import type { DerivativeContract } from "@/lib/brokers/adapter";
import { getNseTickerName } from "@/lib/market-data/nse-ticker-names";

/**
 * Reused across a whole import run so the same handful of exchanges and
 * instruments (e.g. ~200 distinct F&O contracts across an ~11,000-row
 * tradebook) are upserted once instead of once per row — see the
 * resolveInstrument doc comment.
 */
export interface InstrumentResolutionCache {
  exchanges: Map<string, Exchange>;
  instruments: Map<string, Instrument>;
}

export function createInstrumentResolutionCache(): InstrumentResolutionCache {
  return { exchanges: new Map(), instruments: new Map() };
}

const SEGMENT_MAP: Record<string, InstrumentSegment> = {
  EQ: "EQUITY",
  BE: "EQUITY",
  CAPITAL: "EQUITY", // Angel One's equity/ETF segment label
  FUT: "FUTURES",
  OPT: "OPTIONS",
  CDS: "CURRENCY",
  MCX: "COMMODITY",
};

function mapSegment(rawSegment: string): InstrumentSegment {
  return SEGMENT_MAP[rawSegment.toUpperCase()] ?? "EQUITY";
}

/**
 * `expiryDate` is constructed elsewhere as IST midnight (e.g.
 * "2025-04-01T00:00:00+05:30"), so its UTC instant is the previous day
 * 18:30 — reading calendar fields via toISOString() directly would be off
 * by one day. Shifting by the IST offset before formatting recovers the
 * intended IST calendar date.
 */
function istDateToYyyymmdd(date: Date): string {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10).replace(/-/g, "");
}

export interface DerivativeInstrumentFields {
  symbol: string;
  segment: InstrumentSegment;
  underlying: string;
  expiryDate: Date;
  strikePrice: number | null;
  optionType: OptionType | null;
}

/**
 * Builds a deterministic, collision-free canonical symbol for a derivative
 * contract from its parsed fields, rather than trusting the broker's raw
 * display string to be stable/unique. Postgres treats NULL <> NULL in
 * unique indexes, so a structural unique constraint on
 * (underlying, expiryDate, strikePrice, optionType) wouldn't actually catch
 * collisions for futures (whose strikePrice/optionType are null) — encoding
 * everything into one string with no nullable components sidesteps that.
 */
export function buildDerivativeInstrumentFields(derivative: DerivativeContract): DerivativeInstrumentFields {
  const yyyymmdd = istDateToYyyymmdd(derivative.expiryDate);
  const symbol =
    derivative.segment === "OPTIONS"
      ? `${derivative.underlying}-${yyyymmdd}-${derivative.strikePrice!.toFixed(2)}-${derivative.optionType}`
      : `${derivative.underlying}-${yyyymmdd}-FUT`;

  return {
    symbol,
    segment: derivative.segment,
    underlying: derivative.underlying,
    expiryDate: derivative.expiryDate,
    strikePrice: derivative.strikePrice,
    optionType: derivative.optionType,
  };
}

/**
 * Finds or creates the canonical Instrument row for one parsed execution
 * row. Keyed on (exchange, symbol, segment) per the schema's unique
 * constraint; ISIN is stored but not yet used as the join key here (full
 * cross-broker ISIN consolidation is a later-phase feature).
 *
 * `cache` is optional (omitted by the live-sync path, which handles small
 * volumes) — when a bulk-import caller passes one, repeat rows for the same
 * instrument skip the DB round trip entirely after the first occurrence.
 */
export async function resolveInstrument(
  input: {
    exchangeCode: string;
    symbol: string;
    isin: string | null;
    rawSegment: string;
    series: string | null;
    derivative?: DerivativeContract | null;
  },
  cache?: InstrumentResolutionCache
) {
  let exchange = cache?.exchanges.get(input.exchangeCode);
  if (!exchange) {
    exchange = await prisma.exchange.upsert({
      where: { code: input.exchangeCode },
      update: {},
      create: { code: input.exchangeCode, name: input.exchangeCode },
    });
    cache?.exchanges.set(input.exchangeCode, exchange);
  }

  const derivativeFields = input.derivative ? buildDerivativeInstrumentFields(input.derivative) : null;
  const segment = derivativeFields?.segment ?? mapSegment(input.rawSegment);
  const symbol = derivativeFields?.symbol ?? input.symbol;

  const instrumentKey = `${exchange.id}|${symbol}|${segment}`;
  const cached = cache?.instruments.get(instrumentKey);
  if (cached) return cached;

  const instrument = await prisma.instrument.upsert({
    where: {
      exchangeId_symbol_segment: {
        exchangeId: exchange.id,
        symbol,
        segment,
      },
    },
    update: input.isin ? { isin: input.isin } : {},
    create: {
      exchangeId: exchange.id,
      symbol,
      isin: input.isin,
      segment,
      series: input.series,
      name: input.symbol, // raw broker display string — human-readable, unlike the canonical symbol
      underlying: derivativeFields?.underlying,
      expiryDate: derivativeFields?.expiryDate,
      strikePrice: derivativeFields?.strikePrice,
      optionType: derivativeFields?.optionType,
    },
  });
  cache?.instruments.set(instrumentKey, instrument);
  return instrument;
}

function normalizeCompanyName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\b(LIMITED|LTD\.?|PRIVATE|PVT\.?)\b/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Pure matching core, kept separate from the DB fetch below so it's
 * directly unit-testable. Bridges a live-API bare trading symbol (e.g.
 * "WIPRO") to a CSV-imported equity Instrument, when the two disagree on
 * naming. Angel One's "Trades and Charges" export names equity rows by full
 * company display name (e.g. "WIPRO LTD" — verified against a real export,
 * not assumed), while its live SmartAPI holdings/trades endpoints return the
 * bare NSE symbol. The CSV has no ISIN to join on either, so an exact
 * `symbol` match fails for every equity holding pulled live after a CSV
 * import — this is the fallback live-sync holdings-matching needs.
 *
 * Many NSE tickers are abbreviations with no textual relationship to the
 * company name at all (CANBK/Canara Bank, TCS/Tata Consultancy Services,
 * INFY/Infosys, M&M/Mahindra & Mahindra, PFC/Power Finance Corp) — no
 * prefix/suffix rule can bridge those. When the direct ticker-vs-name check
 * fails, this looks the ticker up in NSE_TICKER_NAMES (a real broker's
 * published instrument master, see nse-ticker-names.ts) and retries as a
 * name-to-name comparison instead — "CANARA BANK" (from the table) against
 * "CANARA BANK" (the CSV's own name) is a far more reliable comparison than
 * "CANBK" against "CANARA BANK" ever could be.
 *
 * Deliberately narrow to avoid mismatching two different real stocks: the
 * caller scopes `candidates` to one broker account's own already-imported
 * equity instruments (never the whole DB), and this only returns a match
 * when exactly one candidate matches — an ambiguous or zero-candidate result
 * returns null rather than guessing.
 */
export function matchEquityInstrumentByName<T extends { symbol: string }>(
  candidates: T[],
  liveSymbol: string
): T | null {
  const normalizedLive = liveSymbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const referenceName = getNseTickerName(liveSymbol);
  const normalizedReferenceName = referenceName ? normalizeCompanyName(referenceName) : null;

  const matches = candidates.filter((c) => {
    const normalizedCsv = normalizeCompanyName(c.symbol);
    if (normalizedCsv.length === 0) return false;
    if (normalizedCsv.startsWith(normalizedLive) || normalizedLive.startsWith(normalizedCsv)) return true;
    // Covers AMC-style fund names like "MIRAEAMC - METAL" or
    // "TATAAML-TATAGOLD", where the live ticker appears as a suffix after
    // the fund house's own prefix rather than at the start of the string.
    if (normalizedLive.length >= 4 && normalizedCsv.includes(normalizedLive)) return true;
    // Reference-table bridge for abbreviation-style tickers (see doc comment above).
    if (normalizedReferenceName && normalizedReferenceName.length >= 4) {
      if (normalizedCsv === normalizedReferenceName) return true;
      if (normalizedCsv.startsWith(normalizedReferenceName) || normalizedReferenceName.startsWith(normalizedCsv)) return true;
    }
    return false;
  });
  return matches.length === 1 ? matches[0]! : null;
}
