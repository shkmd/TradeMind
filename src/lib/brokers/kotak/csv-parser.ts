import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { BrokerAdapter, CanonicalExecutionRow, ParsedRow, RowValidationResult, SupportedFileType } from "../adapter";
import { KOTAK_COLUMN_ALIASES, splitKotakExchangeSegment } from "./column-map";
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

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Parses Kotak's "22-Jan-2025" date format explicitly (native Date parsing of this format is unreliable). */
function parseKotakDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const [, day, monAbbr, year] = match;
  const month = MONTHS[monAbbr!.toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${day!.padStart(2, "0")}`;
}

function parseExecutedAt(tradeDateRaw: string, tradeTimeRaw: string): Date | null {
  const isoDate = parseKotakDate(tradeDateRaw) ?? (tradeDateRaw.match(/^\d{4}-\d{2}-\d{2}/) ? tradeDateRaw.slice(0, 10) : null);
  if (!isoDate) return null;
  const time = tradeTimeRaw.trim() || "00:00:00";
  const date = new Date(`${isoDate}T${time}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRow(rowNumber: number, raw: Record<string, string>): ParsedRow {
  const columnMap = resolveColumnMap(Object.keys(raw), KOTAK_COLUMN_ALIASES);
  const errors: string[] = [];

  const symbol = getField(raw, columnMap, "symbol");
  const exchangeSegmentRaw = getField(raw, columnMap, "exchangeSegment");
  const sideRaw = getField(raw, columnMap, "side").trim().toUpperCase();
  const quantityRaw = getField(raw, columnMap, "quantity");
  const priceRaw = getField(raw, columnMap, "price");
  const brokerTradeId = getField(raw, columnMap, "brokerTradeId");
  const brokerOrderId = getField(raw, columnMap, "brokerOrderId");
  const tradeDateRaw = getField(raw, columnMap, "tradeDate");
  const tradeTimeRaw = getField(raw, columnMap, "tradeTime");

  const { exchange, segment } = splitKotakExchangeSegment(exchangeSegmentRaw || "nse_cm");

  if (!symbol) errors.push("Could not find a symbol column in this file");
  if (!["B", "S", "BUY", "SELL"].includes(sideRaw)) errors.push("trnsTp: must be B/BUY or S/SELL");
  if (segment !== "EQ") {
    errors.push(`Segment is "${segment}" — F&O import isn't supported yet for Kotak, only equity rows are imported`);
  }
  const quantity = Number(quantityRaw);
  if (!quantity || quantity <= 0) errors.push("Quantity must be greater than 0");
  const price = Number(priceRaw);
  if (!price || price <= 0) errors.push("Price must be greater than 0");
  if (!brokerTradeId) errors.push("Missing fill/trade id");
  if (!brokerOrderId) errors.push("Missing order number");
  const executedAt = parseExecutedAt(tradeDateRaw, tradeTimeRaw);
  if (!executedAt) errors.push(`Could not parse trade date "${tradeDateRaw}"`);

  if (errors.length > 0 || !executedAt) {
    return { rowNumber, raw, execution: null, errors };
  }

  const execution: CanonicalExecutionRow = {
    symbol: symbol.toUpperCase().replace(/-EQ$/, ""),
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

export const kotakAdapter: BrokerAdapter = {
  brokerCode: "KOTAK",
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
