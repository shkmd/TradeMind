import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { BrokerAdapter, CanonicalExecutionRow, ParsedRow, RowValidationResult, SupportedFileType } from "../adapter";
import { DHAN_COLUMN_ALIASES, splitDhanExchangeSegment } from "./column-map";
import { resolveColumnMap, getField } from "../column-matching";

function rawRowsFromCsv(buffer: Buffer): Record<string, string>[] {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
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
    for (const [key, value] of Object.entries(row)) normalized[key] = String(value ?? "");
    return normalized;
  });
}

function parseExecutedAt(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withOffset = /[+-]\d{2}:?\d{2}$|Z$/.test(normalized) ? normalized : `${normalized}+05:30`;
  const date = new Date(withOffset);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRow(rowNumber: number, raw: Record<string, string>): ParsedRow {
  const columnMap = resolveColumnMap(Object.keys(raw), DHAN_COLUMN_ALIASES);
  const errors: string[] = [];

  const symbol = getField(raw, columnMap, "symbol");
  const exchangeSegmentRaw = getField(raw, columnMap, "exchangeSegment");
  const sideRaw = getField(raw, columnMap, "side").trim().toUpperCase();
  const quantityRaw = getField(raw, columnMap, "quantity");
  const priceRaw = getField(raw, columnMap, "price");
  const brokerTradeId = getField(raw, columnMap, "brokerTradeId");
  const brokerOrderId = getField(raw, columnMap, "brokerOrderId");
  const executedAtRaw = getField(raw, columnMap, "executedAt");

  const { exchange, segment } = splitDhanExchangeSegment(exchangeSegmentRaw || "NSE_EQ");

  if (!symbol) errors.push("Could not find a symbol/trading-symbol column in this file");
  if (!["BUY", "SELL", "B", "S"].includes(sideRaw)) errors.push("transactionType: must be BUY or SELL");
  if (segment !== "EQ") {
    errors.push(`Segment is "${segment}" — F&O import isn't supported yet for Dhan, only equity rows are imported`);
  }
  const quantity = Number(quantityRaw);
  if (!quantity || quantity <= 0) errors.push("Quantity must be greater than 0");
  const price = Number(priceRaw);
  if (!price || price <= 0) errors.push("Price must be greater than 0");
  if (!brokerTradeId) errors.push("Missing exchange trade id");
  if (!brokerOrderId) errors.push("Missing order id");
  const executedAt = parseExecutedAt(executedAtRaw);
  if (!executedAt) errors.push(`executedAt: could not parse "${executedAtRaw}"`);

  if (errors.length > 0 || !executedAt) {
    return { rowNumber, raw, execution: null, errors };
  }

  const execution: CanonicalExecutionRow = {
    symbol: symbol.toUpperCase(),
    isin: getField(raw, columnMap, "isin") || null,
    exchange,
    segment,
    series: null,
    side: sideRaw.startsWith("B") ? "BUY" : "SELL",
    quantity,
    price,
    brokerTradeId,
    brokerOrderId,
    executedAt,
    raw,
  };

  return { rowNumber, raw, execution, errors: [] };
}

export const dhanAdapter: BrokerAdapter = {
  brokerCode: "DHAN",
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
