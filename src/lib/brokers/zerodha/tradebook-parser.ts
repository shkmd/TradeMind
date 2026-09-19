import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { BrokerAdapter, CanonicalExecutionRow, ParsedRow, RowValidationResult, SupportedFileType } from "../adapter";
import { zerodhaTradebookRowSchema } from "./column-map";
import { looksLikeFnoSegment } from "../column-matching";

function parseExecutedAt(orderExecutionTime: string): Date | null {
  // Zerodha format: "2024-01-15 09:20:05" (space-separated, IST wall-clock,
  // no timezone suffix). Treat as Asia/Kolkata by appending the offset
  // explicitly rather than letting the runtime assume local/UTC.
  const normalized = orderExecutionTime.trim().replace(" ", "T");
  const withOffset = /[+-]\d{2}:?\d{2}$|Z$/.test(normalized) ? normalized : `${normalized}+05:30`;
  const date = new Date(withOffset);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rawRowsFromCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  return result.data;
}

function rawRowsFromXlsx(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "_")] = String(value ?? "");
    }
    return normalized;
  });
}

function parseRow(rowNumber: number, raw: Record<string, string>): ParsedRow {
  const parsed = zerodhaTradebookRowSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      rowNumber,
      raw,
      execution: null,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }

  const data = parsed.data;

  if (looksLikeFnoSegment(data.segment)) {
    return {
      rowNumber,
      raw,
      execution: null,
      errors: [`Segment is "${data.segment}" — F&O import isn't supported yet for Zerodha, only equity rows are imported`],
    };
  }

  const executedAt = parseExecutedAt(data.order_execution_time);
  if (!executedAt) {
    return {
      rowNumber,
      raw,
      execution: null,
      errors: [`order_execution_time: could not parse "${data.order_execution_time}"`],
    };
  }

  const execution: CanonicalExecutionRow = {
    symbol: data.symbol.toUpperCase(),
    isin: data.isin || null,
    exchange: data.exchange.toUpperCase(),
    segment: data.segment.toUpperCase(),
    series: data.series || null,
    side: data.trade_type as "BUY" | "SELL",
    quantity: data.quantity,
    price: data.price,
    brokerTradeId: data.trade_id,
    brokerOrderId: data.order_id,
    executedAt,
    raw,
  };

  return { rowNumber, raw, execution, errors: [] };
}

export const zerodhaAdapter: BrokerAdapter = {
  brokerCode: "ZERODHA",
  supportedFileTypes: ["csv", "xlsx"],

  parseFile(buffer: Buffer, fileType: SupportedFileType): ParsedRow[] {
    const rawRows = fileType === "csv" ? rawRowsFromCsv(buffer) : rawRowsFromXlsx(buffer);
    return rawRows.map((raw, index) => parseRow(index + 1, raw));
  },

  validateRow(row: CanonicalExecutionRow): RowValidationResult {
    const errors: string[] = [];
    if (row.quantity <= 0) errors.push("Quantity must be greater than 0");
    if (row.price <= 0) errors.push("Price must be greater than 0");
    if (!["BUY", "SELL"].includes(row.side)) errors.push("Side must be BUY or SELL");
    if (!row.brokerTradeId) errors.push("Missing trade id");
    if (!row.brokerOrderId) errors.push("Missing order id");
    return { valid: errors.length === 0, errors };
  },
};
