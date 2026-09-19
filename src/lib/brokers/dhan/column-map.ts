import type { ColumnAliasMap } from "../column-matching";

/**
 * Dhan's live API (dhanhq.co/docs/v2) uses these field names for a trade
 * record: dhanClientId, orderId, exchangeOrderId, exchangeTradeId,
 * transactionType, exchangeSegment, productType, orderType, tradingSymbol,
 * securityId, tradedQuantity, tradedPrice, isin. Their downloadable
 * "Trade History" CSV (web.dhan.co -> Reports -> Trade History) is
 * expected to use similar-but-not-identical header text — not
 * independently confirmed against a real exported file — hence the
 * multiple aliases per field below rather than one hardcoded guess.
 */
export const DHAN_COLUMN_ALIASES: ColumnAliasMap = {
  symbol: ["tradingSymbol", "trading_symbol", "Trading Symbol", "Symbol", "Scrip Name", "Security Name"],
  isin: ["isin", "ISIN"],
  exchangeSegment: ["exchangeSegment", "exchange_segment", "Exchange Segment", "Exchange", "Segment"],
  side: ["transactionType", "transaction_type", "Transaction Type", "Trade Type", "Side", "Buy/Sell"],
  quantity: ["tradedQuantity", "traded_quantity", "Traded Quantity", "Quantity", "Qty", "Filled Qty"],
  price: ["tradedPrice", "traded_price", "Traded Price", "Price", "Trade Price", "Avg Price"],
  brokerTradeId: ["exchangeTradeId", "exchange_trade_id", "Exchange Trade ID", "Trade ID", "tradeId"],
  brokerOrderId: ["orderId", "order_id", "Order ID", "Order No", "orderNo"],
  executedAt: ["exchangeTime", "exchange_time", "Exchange Time", "Trade Date Time", "Trade Date", "Order Date Time"],
};

/**
 * Dhan's exchangeSegment packs exchange + segment together, e.g.
 * "NSE_EQ", "NSE_FNO", "BSE_EQ", "MCX_COMM". Splits into (exchange, segment).
 */
export function splitDhanExchangeSegment(raw: string): { exchange: string; segment: string } {
  const upper = raw.trim().toUpperCase();
  const parts = upper.split(/[_\s]+/);
  const exchange = parts[0] || "NSE";
  const segmentCode = parts[1] || "EQ";
  const segmentMap: Record<string, string> = {
    EQ: "EQ",
    FNO: "FUT",
    FO: "FUT",
    CURRENCY: "CUR",
    COMM: "COMM",
  };
  return { exchange, segment: segmentMap[segmentCode] ?? segmentCode };
}
