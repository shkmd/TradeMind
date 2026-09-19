import { prisma } from "@/lib/db/prisma";
import { getBrokerAdapter } from "@/lib/brokers/registry";
import { fingerprintForCanonicalRow } from "@/lib/import/dedup";
import type { SupportedFileType } from "@/lib/brokers/adapter";

export interface ImportPreviewRow {
  rowNumber: number;
  symbol: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
  executedAt: string | null;
  status: "VALID" | "INVALID" | "DUPLICATE";
  errors: string[];
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportPreviewRow[];
}

const PREVIEW_ROW_LIMIT = 200;

/**
 * Read-only dry run: parses + validates + checks fingerprints against
 * already-persisted Executions, but writes nothing. Powers the wizard's
 * Preview/Validate/Dedupe steps before the user confirms the import.
 */
export async function previewImport(
  brokerCode: string,
  brokerAccountId: string,
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<ImportPreview> {
  const adapter = getBrokerAdapter(brokerCode);
  if (!adapter) throw new Error(`No adapter implemented for broker "${brokerCode}"`);

  const parsedRows = adapter.parseFile(buffer, fileType);
  const rows: ImportPreviewRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const row of parsedRows.slice(0, PREVIEW_ROW_LIMIT)) {
    if (!row.execution) {
      invalidCount++;
      rows.push({
        rowNumber: row.rowNumber,
        symbol: row.raw.symbol ?? null,
        side: null,
        quantity: null,
        price: null,
        executedAt: null,
        status: "INVALID",
        errors: row.errors,
      });
      continue;
    }

    const validation = adapter.validateRow(row.execution);
    if (!validation.valid) {
      invalidCount++;
      rows.push({
        rowNumber: row.rowNumber,
        symbol: row.execution.symbol,
        side: row.execution.side,
        quantity: row.execution.quantity,
        price: row.execution.price,
        executedAt: row.execution.executedAt.toISOString(),
        status: "INVALID",
        errors: validation.errors,
      });
      continue;
    }

    const fingerprint = fingerprintForCanonicalRow(brokerAccountId, row.execution);
    const existing = await prisma.execution.findUnique({ where: { fingerprint } });

    if (existing) {
      duplicateCount++;
      rows.push({
        rowNumber: row.rowNumber,
        symbol: row.execution.symbol,
        side: row.execution.side,
        quantity: row.execution.quantity,
        price: row.execution.price,
        executedAt: row.execution.executedAt.toISOString(),
        status: "DUPLICATE",
        errors: [],
      });
      continue;
    }

    validCount++;
    rows.push({
      rowNumber: row.rowNumber,
      symbol: row.execution.symbol,
      side: row.execution.side,
      quantity: row.execution.quantity,
      price: row.execution.price,
      executedAt: row.execution.executedAt.toISOString(),
      status: "VALID",
      errors: [],
    });
  }

  // Rows beyond PREVIEW_ROW_LIMIT still count toward totals so the summary
  // is accurate even though we don't render every row.
  for (const row of parsedRows.slice(PREVIEW_ROW_LIMIT)) {
    if (!row.execution || !adapter.validateRow(row.execution).valid) {
      invalidCount++;
    } else {
      const fingerprint = fingerprintForCanonicalRow(brokerAccountId, row.execution);
      const existing = await prisma.execution.findUnique({ where: { fingerprint } });
      if (existing) duplicateCount++;
      else validCount++;
    }
  }

  return {
    totalRows: parsedRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: duplicateCount,
    rows,
  };
}
