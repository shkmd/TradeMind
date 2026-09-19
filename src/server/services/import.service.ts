import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { uploadImportFile, downloadImportFile } from "@/lib/storage/s3";
import { previewImport, type ImportPreview } from "@/lib/import/preview";
import { runImportPipeline, type ImportResult } from "@/lib/import/pipeline";
import { regenerateTradesForInstruments } from "@/lib/import/execution-ingest";
import type { SupportedFileType } from "@/lib/brokers/adapter";

export async function listImportJobs(userId: string) {
  return prisma.importJob.findMany({
    where: { userId },
    include: { brokerAccount: { include: { broker: true } }, files: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getImportJob(userId: string, id: string) {
  return prisma.importJob.findFirst({
    where: { id, userId },
    include: {
      brokerAccount: { include: { broker: true } },
      files: true,
      rows: { orderBy: { rowNumber: "asc" }, take: 500 },
    },
  });
}

interface UploadAndPreviewInput {
  userId: string;
  brokerAccountId: string;
  brokerCode: string;
  fileName: string;
  fileType: SupportedFileType;
  mimeType: string;
  buffer: Buffer;
}

/** Uploads the file, creates the ImportJob (status UPLOADED), and runs a read-only preview. */
export async function uploadAndPreviewImport(
  input: UploadAndPreviewInput
): Promise<{ importJobId: string; preview: ImportPreview }> {
  const checksum = createHash("sha256").update(input.buffer).digest("hex");
  const s3Key = `imports/${input.userId}/${Date.now()}-${input.fileName}`;
  await uploadImportFile(s3Key, input.buffer, input.mimeType);

  const importJob = await prisma.importJob.create({
    data: {
      userId: input.userId,
      brokerAccountId: input.brokerAccountId,
      broker: input.brokerCode,
      reportType: "TRADEBOOK",
      status: "UPLOADED",
      files: {
        create: {
          originalName: input.fileName,
          s3Key,
          s3Bucket: process.env.S3_BUCKET_IMPORTS ?? "trademind-imports",
          mimeType: input.mimeType,
          sizeBytes: input.buffer.byteLength,
          checksumSha256: checksum,
        },
      },
    },
  });

  const preview = await previewImport(input.brokerCode, input.brokerAccountId, input.buffer, input.fileType);

  return { importJobId: importJob.id, preview };
}

export async function getImportPreview(userId: string, importJobId: string): Promise<ImportPreview> {
  const job = await prisma.importJob.findFirstOrThrow({
    where: { id: importJobId, userId },
    include: { files: true },
  });
  const file = job.files[0];
  if (!file) throw new Error("No file attached to this import job");

  const buffer = await downloadImportFile(file.s3Key);
  const fileType: SupportedFileType = file.originalName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  return previewImport(job.broker, job.brokerAccountId, buffer, fileType);
}

export async function confirmImport(userId: string, importJobId: string): Promise<ImportResult> {
  const job = await prisma.importJob.findFirstOrThrow({ where: { id: importJobId, userId } });
  return runImportPipeline(job.id);
}

export interface RollbackResult {
  executionsRemoved: number;
  instrumentsAffected: number;
  tradesRegenerated: number;
}

/**
 * Undoes one import: soft-deletes every Execution this job created, marks
 * the job ROLLED_BACK, and regenerates Trades for every instrument touched
 * (so any executions from OTHER imports on the same instrument are correctly
 * re-grouped, rather than just deleting trades outright). Never touches
 * ImportRow/ImportFile rows — those stay as a historical record of what was
 * attempted, per the schema's `ImportJobStatus.ROLLED_BACK` design.
 */
export async function rollbackImportJob(userId: string, importJobId: string): Promise<RollbackResult> {
  const job = await prisma.importJob.findFirstOrThrow({ where: { id: importJobId, userId } });
  if (job.status === "ROLLED_BACK") {
    throw new Error("This import has already been rolled back.");
  }

  const rows = await prisma.importRow.findMany({
    where: { importJobId, executionId: { not: null } },
    select: { execution: { select: { id: true, instrumentId: true } } },
  });
  const executions = rows.map((r) => r.execution!).filter(Boolean);
  const executionIds = executions.map((e) => e.id);
  const instrumentIds = [...new Set(executions.map((e) => e.instrumentId))];

  if (executionIds.length > 0) {
    await prisma.execution.updateMany({
      where: { id: { in: executionIds } },
      data: { deletedAt: new Date() },
    });
  }

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
  });

  const tradesRegenerated = await regenerateTradesForInstruments(userId, job.brokerAccountId, instrumentIds);

  return { executionsRemoved: executionIds.length, instrumentsAffected: instrumentIds.length, tradesRegenerated };
}
