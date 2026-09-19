import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { downloadImportFile, getSignedImportUploadUrl } from "@/lib/storage/s3";
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

/**
 * Reserves a storage key and returns a short-lived signed PUT URL so the
 * browser can upload the tradebook file directly to R2 — see
 * getSignedImportUploadUrl's doc comment for why this bypasses our server
 * entirely rather than going through a server action's request body.
 */
export async function createImportUploadUrl(
  userId: string,
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Key = `imports/${userId}/${Date.now()}-${fileName}`;
  const uploadUrl = await getSignedImportUploadUrl(s3Key, mimeType);
  return { uploadUrl, s3Key };
}

interface CreateImportJobInput {
  userId: string;
  brokerAccountId: string;
  brokerCode: string;
  fileName: string;
  fileType: SupportedFileType;
  mimeType: string;
  s3Key: string;
  /** Enforced here, not just client-side, since the client's own check is trivially bypassable. */
  maxSizeBytes?: number;
}

/**
 * Given a file the browser has already uploaded to `s3Key` (see
 * createImportUploadUrl), creates the ImportJob (status UPLOADED) and runs a
 * read-only preview. Downloads the file back from storage once, server-side,
 * to compute its checksum and feed the parser — that read is a normal
 * outbound request our server makes on its own terms, not something a
 * client's inbound body size limit can truncate.
 */
export async function createImportJobAndPreview(
  input: CreateImportJobInput
): Promise<{ importJobId: string; preview: ImportPreview }> {
  const buffer = await downloadImportFile(input.s3Key);
  if (input.maxSizeBytes && buffer.byteLength > input.maxSizeBytes) {
    throw new Error(`File is too large (max ${Math.floor(input.maxSizeBytes / (1024 * 1024))}MB).`);
  }
  const checksum = createHash("sha256").update(buffer).digest("hex");

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
          s3Key: input.s3Key,
          s3Bucket: process.env.S3_BUCKET_IMPORTS ?? "trademind-imports",
          mimeType: input.mimeType,
          sizeBytes: buffer.byteLength,
          checksumSha256: checksum,
        },
      },
    },
  });

  const preview = await previewImport(input.brokerCode, input.brokerAccountId, buffer, input.fileType);

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
