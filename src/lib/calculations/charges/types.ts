import type Decimal from "decimal.js";
import type { TradeProductType, TradeSide } from "@prisma/client";

export type ChargeSegment = "EQUITY" | "FUTURES" | "OPTIONS";

export interface ChargeInput {
  side: TradeSide;
  quantity: number;
  price: Decimal;
  productType: TradeProductType;
  exchange: "NSE" | "BSE" | "MCX";
  /** Defaults to "EQUITY" when omitted, so existing call sites/tests keep compiling. */
  segment?: ChargeSegment;
}

export interface ChargeBreakdown {
  turnover: Decimal;
  brokerage: Decimal;
  sttCtt: Decimal;
  exchangeTxnCharge: Decimal;
  sebiCharges: Decimal;
  stampDuty: Decimal;
  gst: Decimal;
  totalCharges: Decimal;
}
