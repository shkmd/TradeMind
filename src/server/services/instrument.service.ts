import { prisma } from "@/lib/db/prisma";
import type { InstrumentSegment, OptionType } from "@prisma/client";
import type { DerivativeContract } from "@/lib/brokers/adapter";

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
 */
export async function resolveInstrument(input: {
  exchangeCode: string;
  symbol: string;
  isin: string | null;
  rawSegment: string;
  series: string | null;
  derivative?: DerivativeContract | null;
}) {
  const exchange = await prisma.exchange.upsert({
    where: { code: input.exchangeCode },
    update: {},
    create: { code: input.exchangeCode, name: input.exchangeCode },
  });

  const derivativeFields = input.derivative ? buildDerivativeInstrumentFields(input.derivative) : null;
  const segment = derivativeFields?.segment ?? mapSegment(input.rawSegment);
  const symbol = derivativeFields?.symbol ?? input.symbol;

  return prisma.instrument.upsert({
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
}
