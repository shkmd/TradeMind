import type { ColumnAliasMap } from "../column-matching";

/**
 * Kotak Neo's trade_report response (verified against a real sample in
 * Kotak-Neo/Kotak-neo-api-v2's official docs/Trade_report.md) uses: trdSym
 * ("IDEA-EQ"), sym ("IDEA"), trnsTp ("B"/"S"), fldQty, avgPrc, exSeg
 * ("nse_cm"), flDt ("22-Jan-2025"), flTm ("14:28:16"), nOrdNo, exOrdId,
 * flId, prod, series. Their downloadable trade-report CSV export's header
 * text is not independently confirmed against a real file — aliases
 * tolerate reasonable variation.
 */
export const KOTAK_COLUMN_ALIASES: ColumnAliasMap = {
  symbol: ["sym", "trdSym", "trading_symbol", "Trading Symbol", "Symbol", "Scrip"],
  isin: ["isin", "ISIN"],
  exchangeSegment: ["exSeg", "exchange_segment", "Exchange Segment", "Exchange", "Segment"],
  side: ["trnsTp", "transaction_type", "Transaction Type", "Buy/Sell", "Side"],
  quantity: ["fldQty", "filled_quantity", "Filled Qty", "Quantity", "Qty"],
  price: ["avgPrc", "average_price", "Avg Price", "Price", "Trade Price"],
  brokerTradeId: ["flId", "exOrdId", "fill_id", "Fill ID", "Trade ID"],
  brokerOrderId: ["nOrdNo", "order_no", "Order No", "Order ID"],
  tradeDate: ["flDt", "trade_date", "Trade Date", "Fill Date"],
  tradeTime: ["flTm", "trade_time", "Trade Time", "Fill Time"],
};

/** Kotak's exSeg packs exchange + segment together, e.g. "nse_cm", "nse_fo", "bse_cm". */
export function splitKotakExchangeSegment(raw: string): { exchange: string; segment: string } {
  const lower = raw.trim().toLowerCase();
  const parts = lower.split(/[_\s]+/);
  const exchange = (parts[0] || "nse").toUpperCase();
  const segmentCode = parts[1] || "cm";
  const segmentMap: Record<string, string> = { cm: "EQ", fo: "FUT", cd: "CUR" };
  return { exchange, segment: segmentMap[segmentCode] ?? segmentCode.toUpperCase() };
}
