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

  // Fingerprint every structurally-valid row up front and check them all in
  // one query. The previous per-row `findUnique` in this loop meant a real
  // ~11,000-row F&O tradebook made ~11,000 sequential DB round trips —
  // 100+ seconds against a hosted (non-local) Postgres, looking like the
  // page had hung.
  const fingerprintByRowNumber = new Map<number, string>();
  for (const row of parsedRows) {
    if (row.execution && adapter.validateRow(row.execution).valid) {
      fingerprintByRowNumber.set(row.rowNumber, fingerprintForCanonicalRow(brokerAccountId, row.execution));
    }
  }
  const allFingerprints = Array.from(fingerprintByRowNumber.values());
  const existingFingerprints =
    allFingerprints.length > 0
      ? new Set(
          (
            await prisma.execution.findMany({
              where: { fingerprint: { in: allFingerprints } },
              select: { fingerprint: true },
            })
          ).map((e) => e.fingerprint)
        )
      : new Set<string>();

  const rows: ImportPreviewRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const classify = (row: (typeof parsedRows)[number]): "VALID" | "INVALID" | "DUPLICATE" => {
    if (!row.execution || !adapter.validateRow(row.execution).valid) return "INVALID";
    const fingerprint = fingerprintByRowNumber.get(row.rowNumber)!;
    return existingFingerprints.has(fingerprint) ? "DUPLICATE" : "VALID";
  };

  for (const row of parsedRows.slice(0, PREVIEW_ROW_LIMIT)) {
    const status = classify(row);
    if (status === "INVALID") {
      invalidCount++;
      const validation = row.execution ? adapter.validateRow(row.execution) : null;
      rows.push({
        rowNumber: row.rowNumber,
        symbol: row.execution?.symbol ?? row.raw.symbol ?? null,
        side: row.execution?.side ?? null,
        quantity: row.execution?.quantity ?? null,
        price: row.execution?.price ?? null,
        executedAt: row.execution?.executedAt.toISOString() ?? null,
        status: "INVALID",
        errors: validation?.errors ?? row.errors,
      });
      continue;
    }

    if (status === "DUPLICATE") duplicateCount++;
    else validCount++;

    rows.push({
      rowNumber: row.rowNumber,
      symbol: row.execution!.symbol,
      side: row.execution!.side,
      quantity: row.execution!.quantity,
      price: row.execution!.price,
      executedAt: row.execution!.executedAt.toISOString(),
      status,
      errors: [],
    });
  }

  // Rows beyond PREVIEW_ROW_LIMIT still count toward totals so the summary
  // is accurate even though we don't render every row.
  for (const row of parsedRows.slice(PREVIEW_ROW_LIMIT)) {
    const status = classify(row);
    if (status === "INVALID") invalidCount++;
    else if (status === "DUPLICATE") duplicateCount++;
    else validCount++;
  }

  return {
    totalRows: parsedRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: duplicateCount,
    rows,
  };
}
