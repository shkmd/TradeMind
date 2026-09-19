import Decimal from "decimal.js";
import type { ChargeInput, ChargeSegment } from "./types";

/**
 * Regulatory/exchange charges are set by SEBI/the exchanges/the government,
 * not by the broker — identical across Zerodha, Dhan, Upstox, Angel One,
 * Kotak, etc. Only brokerage differs per broker (see brokerage-formulas.ts).
 * Named constants, not a versioned DB model — see the note in
 * zerodha-equity.ts about migrating this to a `ChargeRate` table.
 */
const DELIVERY_STT_RATE = new Decimal("0.001"); // 0.1%, both legs
const INTRADAY_STT_RATE = new Decimal("0.00025"); // 0.025%, sell leg only

// NSE only this phase — BSE rate is approximate/unused until a BSE fixture exists.
const NSE_EXCHANGE_TXN_RATE = new Decimal("0.0000297");

const SEBI_CHARGE_RATE = new Decimal("0.000001"); // ₹10 per crore — verified universal across equity and F&O

/**
 * Stamp duty defaults to the Maharashtra rate as a simplification — the
 * real rate depends on the trader's state of registration with the broker,
 * which this phase's data model doesn't capture.
 */
const DELIVERY_STAMP_DUTY_RATE = new Decimal("0.00015"); // 0.015%, buy side only
const INTRADAY_STAMP_DUTY_RATE = new Decimal("0.00003"); // 0.003%, buy side only

export const GST_RATE = new Decimal("0.18");

export interface RegulatoryCharges {
  turnover: Decimal;
  sttCtt: Decimal;
  exchangeTxnCharge: Decimal;
  sebiCharges: Decimal;
  stampDuty: Decimal;
}

function calculateEquityRegulatoryCharges(input: ChargeInput): RegulatoryCharges {
  const turnover = input.price.times(input.quantity);
  const isBuy = input.side === "BUY";
  const isIntraday = input.productType === "INTRADAY";

  let sttCtt: Decimal;
  if (isIntraday) {
    sttCtt = isBuy ? new Decimal(0) : turnover.times(INTRADAY_STT_RATE);
  } else {
    sttCtt = turnover.times(DELIVERY_STT_RATE);
  }

  const exchangeTxnCharge = turnover.times(NSE_EXCHANGE_TXN_RATE);
  const sebiCharges = turnover.times(SEBI_CHARGE_RATE);
  const stampDuty = isBuy
    ? turnover.times(isIntraday ? INTRADAY_STAMP_DUTY_RATE : DELIVERY_STAMP_DUTY_RATE)
    : new Decimal(0);

  return { turnover, sttCtt, exchangeTxnCharge, sebiCharges, stampDuty };
}

/**
 * F&O rate constants — calibrated against a real Angel One "Trades and
 * Charges" export (thousands of broker-reported STT/exchange-txn/stamp-duty
 * values cross-checked against these candidate rates, not general SEBI
 * knowledge). India's F&O regulatory rates key off OPTIONS-vs-FUTURES and
 * BUY-vs-SELL, not holding period — there's no INTRADAY/DELIVERY split here
 * the way there is for equity.
 *
 * CURRENT RATES ONLY, deliberately not versioned by date (same scope
 * decision already accepted for the equity constants above — see the
 * comment on migrating to a `ChargeRate` table). These rates genuinely
 * changed mid-year in the calibration data: BSE's options exchange-txn
 * charge went through three regimes across FY2024-25 (~0.0375% ->
 * ~0.0495% -> ~0.0325%), and India's options STT was hiked from 0.0625% to
 * 0.1% on 2024-10-01 (a real, public regulatory change, not a calibration
 * error). The constants below match the CURRENT (post-2024-10-01) regime —
 * confirmed via a 100% match on exchange-txn-charge and ~95%+ match on
 * STT/stamp-duty against every real row dated on/after that cutover.
 * Charges for F&O trades before ~Oct 2024 will be computed with today's
 * rates rather than the rates that applied then.
 *
 * Remaining small STT/stamp-duty deviations even within the current regime
 * are the same per-leg-vs-per-order allocation quirk already documented for
 * brokerage (see brokerage-formulas.ts / the plan's flagged simplifications)
 * — the broker concentrates some per-order charges onto one fill row rather
 * than spreading them proportionally, which this per-leg engine doesn't
 * replicate byte-for-byte. Rates themselves are confirmed correct.
 */
// Sell-side STT/CTT on premium (options) or turnover (futures).
const OPTIONS_STT_RATE_EQUITY_INDEX = new Decimal("0.001"); // 0.1% — NSE OPTIDX/OPTSTK + BSE BSXOPT/BKXOPT, confirmed
const OPTIONS_STT_RATE_COMMODITY = new Decimal("0.0005"); // 0.05% — MCX OPTFUT, confirmed (half the equity-index rate)
const FUTURES_CTT_RATE_COMMODITY = new Decimal("0.0001"); // 0.01% — MCX FUTCOM, confirmed
// Equity-index futures (NSE/BSE) have no verified sample yet — deliberately
// no constant here; calculateDerivativeRegulatoryCharges throws rather than
// guess if that combination is ever requested (see scope note in the plan).

// Exchange transaction charge — varies by exchange AND by options-vs-futures,
// confirmed distinct for every (exchange, segment) pair sampled.
const EXCHANGE_TXN_RATE: Partial<Record<ChargeInput["exchange"], Partial<Record<"OPTIONS" | "FUTURES", Decimal>>>> = {
  NSE: { OPTIONS: new Decimal("0.0003503") },
  BSE: { OPTIONS: new Decimal("0.000327") },
  MCX: { OPTIONS: new Decimal("0.000418"), FUTURES: new Decimal("0.000021") },
};

// Buy-side only, keyed on options-vs-futures — confirmed the SAME rate
// applies across NSE/BSE/MCX (nationally uniform since the Finance Act 2019
// stamp-duty centralization), unlike the exchange-txn charge above.
const OPTIONS_STAMP_DUTY_RATE = new Decimal("0.00003"); // 0.003%
const FUTURES_STAMP_DUTY_RATE = new Decimal("0.00002"); // 0.002%

function calculateDerivativeRegulatoryCharges(input: ChargeInput, segment: "OPTIONS" | "FUTURES"): RegulatoryCharges {
  const turnover = input.price.times(input.quantity);
  const isBuy = input.side === "BUY";
  const isCommodity = input.exchange === "MCX";

  const sttCttRate =
    segment === "OPTIONS"
      ? isCommodity
        ? OPTIONS_STT_RATE_COMMODITY
        : OPTIONS_STT_RATE_EQUITY_INDEX
      : FUTURES_CTT_RATE_COMMODITY; // only commodity futures are verified/supported this phase
  const sttCtt = isBuy ? new Decimal(0) : turnover.times(sttCttRate);

  const exchangeTxnRate = EXCHANGE_TXN_RATE[input.exchange]?.[segment];
  if (!exchangeTxnRate) {
    throw new Error(
      `No verified exchange transaction charge rate for ${input.exchange} ${segment} — this combination isn't supported yet.`
    );
  }
  const exchangeTxnCharge = turnover.times(exchangeTxnRate);

  const sebiCharges = turnover.times(SEBI_CHARGE_RATE);

  const stampDutyRate = segment === "OPTIONS" ? OPTIONS_STAMP_DUTY_RATE : FUTURES_STAMP_DUTY_RATE;
  const stampDuty = isBuy ? turnover.times(stampDutyRate) : new Decimal(0);

  return { turnover, sttCtt, exchangeTxnCharge, sebiCharges, stampDuty };
}

export function calculateRegulatoryCharges(input: ChargeInput): RegulatoryCharges {
  const segment: ChargeSegment = input.segment ?? "EQUITY";
  if (segment === "EQUITY") return calculateEquityRegulatoryCharges(input);
  return calculateDerivativeRegulatoryCharges(input, segment);
}
