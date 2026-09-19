import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getBrokerAdapter } from "@/lib/brokers/registry";
import { downloadImportFile } from "@/lib/storage/s3";
import { persistExecutionIfNew, regenerateTradesForInstruments } from "@/lib/import/execution-ingest";

export interface ImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  tradesGenerated: number;
}

/**
 * Orchestrates one CSV/XLSX import job end to end: download -> parse ->
 * validate -> dedupe -> persist Executions -> FIFO-group into Trades ->
 * charges/P&L -> initial rule evaluation. Runs synchronously inside a
 * Server Action this phase (see lib/queue/queues.ts for the deferred
 * BullMQ wiring) — this function's signature (`(importJobId) =>
 * Promise<ImportResult>`, reading everything it needs from the DB) is
 * worker-ready for when that changes.
 *
 * The dedupe/persist/trade-grouping core is shared with the live
 * broker-API sync path (see server/services/broker-connect.service.ts) via
 * lib/import/execution-ingest.ts — both feed the same canonical tables.
 */
export async function runImportPipeline(importJobId: string): Promise<ImportResult> {
  const job = await prisma.importJob.findUniqueOrThrow({
    where: { id: importJobId },
    include: { files: true, brokerAccount: true },
  });

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "PARSING", startedAt: new Date() },
  });

  const adapter = getBrokerAdapter(job.broker);
  if (!adapter) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "FAILED", errorMessage: `No adapter implemented for broker "${job.broker}"` },
    });
    throw new Error(`No adapter implemented for broker "${job.broker}"`);
  }

  const file = job.files[0];
  if (!file) {
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "FAILED", errorMessage: "No file attached to this import job" },
    });
    throw new Error("No file attached to this import job");
  }

  const buffer = await downloadImportFile(file.s3Key);
  const fileType = file.originalName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  const parsedRows = adapter.parseFile(buffer, fileType);

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const touchedInstrumentIds = new Set<string>();

  for (const row of parsedRows) {
    if (!row.execution) {
      await prisma.importRow.create({
        data: { importJobId, rowNumber: row.rowNumber, rawData: row.raw, status: "INVALID", errors: row.errors },
      });
      invalidCount++;
      continue;
    }

    const rowValidation = adapter.validateRow(row.execution);
    if (!rowValidation.valid) {
      await prisma.importRow.create({
        data: {
          importJobId,
          rowNumber: row.rowNumber,
          rawData: row.raw,
          status: "INVALID",
          errors: rowValidation.errors,
        },
      });
      invalidCount++;
      continue;
    }

    const result = await persistExecutionIfNew(job.brokerAccountId, row.execution);

    if (result.status === "DUPLICATE") {
      await prisma.importRow.create({
        data: {
          importJobId,
          rowNumber: row.rowNumber,
          rawData: row.raw,
          status: "DUPLICATE",
          fingerprint: result.fingerprint,
          isDuplicate: true,
        },
      });
      duplicateCount++;
      continue;
    }

    if (result.instrumentId) touchedInstrumentIds.add(result.instrumentId);

    await prisma.importRow.create({
      data: {
        importJobId,
        rowNumber: row.rowNumber,
        rawData: row.raw,
        status: "IMPORTED",
        fingerprint: result.fingerprint,
        executionId: result.executionId,
      },
    });
    validCount++;
  }

  const tradesGenerated = await regenerateTradesForInstruments(
    job.userId,
    job.brokerAccountId,
    Array.from(touchedInstrumentIds)
  );

  const result: ImportResult = {
    totalRows: parsedRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: duplicateCount,
    tradesGenerated,
  };

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: "COMPLETED",
      totalRows: result.totalRows,
      validRows: result.validRows,
      invalidRows: result.invalidRows,
      duplicateRows: result.duplicateRows,
      tradesGenerated: result.tradesGenerated,
      completedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: job.userId,
      action: "IMPORT_COMPLETED",
      entityType: "ImportJob",
      entityId: importJobId,
      metadata: result as unknown as Prisma.InputJsonObject,
    },
  });

  return result;
}
