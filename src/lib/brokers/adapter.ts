export type SupportedFileType = "csv" | "xlsx";

export interface DerivativeContract {
  underlying: string;
  expiryDate: Date;
  /** null for futures contracts (no strike). */
  strikePrice: number | null;
  /** null for futures contracts. */
  optionType: "CE" | "PE" | null;
  segment: "OPTIONS" | "FUTURES";
}

export interface CanonicalExecutionRow {
  symbol: string;
  isin: string | null;
  exchange: string;
  segment: string;
  series: string | null;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  brokerTradeId: string;
  brokerOrderId: string;
  executedAt: Date;
  /** Populated only by adapters that support F&O contract parsing. */
  derivative?: DerivativeContract | null;
  /** Raw source row, retained for ImportRow.rawData / debugging. */
  raw: Record<string, string>;
}

export interface RowValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * One row of raw file data, parsed to a canonical execution when it's
 * well-formed. Malformed rows (missing price, unparseable date, ...) keep
 * their raw data + reasons so the import wizard's Validate step can show
 * them, rather than being silently dropped.
 */
export interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  execution: CanonicalExecutionRow | null;
  errors: string[];
}

/**
 * Every broker plugs into this interface. Only Zerodha is implemented this
 * phase (see registry.ts) — Dhan/Upstox/Angel One/Fyers/Groww are
 * registered as `isImplemented: false` stubs so the Broker Accounts UI can
 * list them as "coming soon" without new schema.
 */
export interface BrokerAdapter {
  brokerCode: string;
  supportedFileTypes: SupportedFileType[];
  parseFile(buffer: Buffer, fileType: SupportedFileType): ParsedRow[];
  validateRow(row: CanonicalExecutionRow): RowValidationResult;
}
