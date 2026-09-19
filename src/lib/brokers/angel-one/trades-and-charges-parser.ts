import * as XLSX from "xlsx";
import type { BrokerAdapter, CanonicalExecutionRow, DerivativeContract, ParsedRow, RowValidationResult, SupportedFileType } from "../adapter";
import { parseAngelContract } from "./contract-parser";

/**
 * Angel One's "Trades and Charges" report (Web platform → Download Reports →
 * Stocks, SGBs, Bonds and FnO → Trades and Charges, XLSX only — confirmed
 * against a real downloaded file, not guessed). The sheet has a metadata
 * block (client code, date range, charges summary) before the actual trade
 * table, whose header row starts with "Scrip/Contract".
 *
 * Angel One tags EVERY F&O row (both futures and options contracts, across
 * NSE/BSE index derivatives and MCX commodity derivatives) with Segment
 * "FUTURES" — equity/ETF trades are tagged "CAPITAL". FUTURES-segment rows
 * are parsed via contract-parser.ts (four real shapes confirmed: BSXOPT/
 * OPTIDX index options, OPTFUT commodity options, FUTCOM commodity
 * futures) and rejected only when the contract string doesn't match one of
 * those shapes — e.g. an equity-index futures contract, which has no
 * verified real sample yet.
 */
const HEADER_MARKER = "scrip/contract";

interface ColumnIndex {
  scrip: number;
  buySell: number;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  orderType: number;
  segment: number;
  exchange: number;
  orderId: number;
  tradeId: number;
  date: number;
}

function findHeaderRow(rows: string[][]): { headerIndex: number; columns: ColumnIndex } | null {
  const headerIndex = rows.findIndex((row) => (row[0] ?? "").trim().toLowerCase() === HEADER_MARKER);
  if (headerIndex === -1) return null;

  const header = rows[headerIndex]!.map((cell) => cell.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const columns: ColumnIndex = {
    scrip: col("scrip/contract"),
    buySell: col("buy/sell"),
    buyPrice: col("buy price"),
    sellPrice: col("sell price"),
    quantity: col("quantity"),
    orderType: col("order type"),
    segment: col("segment"),
    exchange: col("exchange"),
    orderId: col("order id"),
    tradeId: col("trade id"),
    date: col("date"),
  };

  if (Object.values(columns).some((idx) => idx === -1)) return null;
  return { headerIndex, columns };
}

/** Angel's export renders dates as "M/D/YY H:mm" (e.g. "3/26/25 0:00"), IST wall-clock, no seconds. */
function parseAngelDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, m, d, y, h, min] = match;
  const year = y!.length === 2 ? `20${y}` : y;
  const iso = `${year}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T${h!.padStart(2, "0")}:${min}:00+05:30`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function parseRow(rowNumber: number, row: string[], columns: ColumnIndex, raw: Record<string, string>): ParsedRow {
  const scrip = (row[columns.scrip] ?? "").trim();
  const sideRaw = (row[columns.buySell] ?? "").trim().toUpperCase();
  const segment = (row[columns.segment] ?? "").trim().toUpperCase();
  const exchange = (row[columns.exchange] ?? "").trim().toUpperCase();
  const orderId = (row[columns.orderId] ?? "").trim();
  const tradeId = (row[columns.tradeId] ?? "").trim();
  const dateRaw = (row[columns.date] ?? "").trim();

  const errors: string[] = [];

  if (!scrip) errors.push("Could not find a trading-symbol column in this file; expected a Scrip/Contract column");
  if (!["BUY", "SELL"].includes(sideRaw)) errors.push("Buy/Sell: must be Buy or Sell");

  let derivative: DerivativeContract | null = null;
  if (segment === "FUTURES") {
    const parsed = parseAngelContract(scrip);
    if (!parsed.ok) {
      errors.push(...parsed.reasons);
    } else {
      derivative = parsed.contract;
    }
  } else if (segment !== "CAPITAL") {
    errors.push(`Segment is "${segment || "unknown"}" — not supported yet, only CAPITAL (equity) and FUTURES (F&O) rows are imported`);
  }

  const quantity = parseNumber(row[columns.quantity] ?? "");
  if (!quantity || quantity <= 0) errors.push("Quantity must be greater than 0");

  const price = sideRaw === "BUY" ? parseNumber(row[columns.buyPrice] ?? "") : parseNumber(row[columns.sellPrice] ?? "");
  if (!price || price <= 0) errors.push("Price must be greater than 0");

  if (!orderId) errors.push("Missing order id");

  const executedAt = parseAngelDate(dateRaw);
  if (!executedAt) errors.push(`Could not parse trade date "${dateRaw}"`);

  if (errors.length > 0 || !executedAt) {
    return { rowNumber, raw, execution: null, errors };
  }

  const execution: CanonicalExecutionRow = {
    symbol: scrip.toUpperCase(),
    isin: null,
    exchange: exchange || "NSE",
    segment,
    series: null,
    side: sideRaw as "BUY" | "SELL",
    quantity,
    price,
    // Trade ID is blank on some rows (partial/unmatched fills) — fall back
    // to the order id so a real row is never rejected for a missing id.
    brokerTradeId: tradeId || orderId,
    brokerOrderId: orderId,
    executedAt,
    derivative,
    raw,
  };

  return { rowNumber, raw, execution, errors: [] };
}

export const angelOneAdapter: BrokerAdapter = {
  brokerCode: "ANGEL_ONE",
  supportedFileTypes: ["xlsx"],

  parseFile(buffer: Buffer, fileType: SupportedFileType): ParsedRow[] {
    if (fileType !== "xlsx") {
      return [{ rowNumber: 1, raw: {}, execution: null, errors: ["Angel One only exports this report as .xlsx"] }];
    }

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false }) as unknown as string[][];
    const found = findHeaderRow(rows);
    if (!found) {
      return [
        {
          rowNumber: 1,
          raw: {},
          execution: null,
          errors: [
            'Could not find the trades table in this file — expected a "Scrip/Contract" header row. Make sure you downloaded the "Trades and Charges" report, not a P&L Statement.',
          ],
        },
      ];
    }

    const { headerIndex, columns } = found;
    const header = rows[headerIndex]!;
    const dataRows = rows.slice(headerIndex + 1).filter((row) => (row[columns.scrip] ?? "").trim() !== "");

    return dataRows.map((row, index) => {
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h.trim()] = row[i] ?? ""));
      return parseRow(index + 1, row, columns, raw);
    });
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
