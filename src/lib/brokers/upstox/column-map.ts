import type { ColumnAliasMap } from "../column-matching";

/**
 * Upstox's live API (verified against the official upstox-nodejs SDK's
 * TradeHistoryResponseTradeData model) uses: exchange, segment, quantity,
 * amount, trade_id, trade_date, transaction_type, scrip_name, price, isin,
 * symbol. Their downloadable trade-history CSV header text is not
 * independently confirmed against a real exported file — aliases below
 * tolerate the CSV using different (e.g. Title Case) header text.
 */
export const UPSTOX_COLUMN_ALIASES: ColumnAliasMap = {
  symbol: ["symbol", "Symbol", "scrip_name", "Scrip Name", "Trading Symbol", "tradingsymbol"],
  isin: ["isin", "ISIN"],
  exchange: ["exchange", "Exchange"],
  segment: ["segment", "Segment"],
  side: ["transaction_type", "Transaction Type", "Trade Type", "Side", "Buy/Sell"],
  quantity: ["quantity", "Quantity", "Qty"],
  price: ["price", "Price", "Trade Price", "Avg Price"],
  brokerTradeId: ["trade_id", "Trade ID", "tradeId"],
  brokerOrderId: ["order_id", "Order ID", "order_no", "Order No"],
  executedAt: ["trade_date", "Trade Date", "trade_timestamp", "Trade Date Time", "Order Timestamp"],
};
