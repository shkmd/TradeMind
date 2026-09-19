import { z } from "zod";

/**
 * Zerodha Console "Tradebook" export columns (both the CSV and XLSX
 * downloads use this header set). trade_type is BUY/SELL; order_execution_time
 * carries the full timestamp, trade_date is date-only.
 */
export const ZERODHA_TRADEBOOK_COLUMNS = [
  "symbol",
  "isin",
  "trade_date",
  "exchange",
  "segment",
  "series",
  "trade_type",
  "auction",
  "quantity",
  "price",
  "trade_id",
  "order_id",
  "order_execution_time",
] as const;

export const zerodhaTradebookRowSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required"),
  isin: z.string().trim().optional().default(""),
  trade_date: z.string().trim().min(1, "Trade date is required"),
  exchange: z.string().trim().min(1, "Exchange is required"),
  segment: z.string().trim().min(1, "Segment is required"),
  series: z.string().trim().optional().default(""),
  trade_type: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "BUY" || v === "SELL", { message: "trade_type must be BUY or SELL" }),
  auction: z.string().trim().optional().default(""),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  trade_id: z.string().trim().min(1, "trade_id is required"),
  order_id: z.string().trim().min(1, "order_id is required"),
  order_execution_time: z.string().trim().min(1, "order_execution_time is required"),
});

export type ZerodhaTradebookRow = Record<(typeof ZERODHA_TRADEBOOK_COLUMNS)[number], string>;
