"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/rbac";
import {
  createImportUploadUrl,
  createImportJobAndPreview,
  confirmImport,
  rollbackImportJob,
} from "@/server/services/import.service";
import type { SupportedFileType } from "@/lib/brokers/adapter";
import type { ImportPreview } from "@/lib/import/preview";
import type { ImportResult } from "@/lib/import/pipeline";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Step 1 of 2: get a short-lived signed URL so the browser can PUT the file
 * straight to storage. See getSignedImportUploadUrl's doc comment for why —
 * sending the file through a server action's request body hit an empty-body
 * failure in production for a real ~11,000-row file, most likely a
 * proxy-level size limit ahead of the app.
 */
export async function getImportUploadUrlAction(
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const session = await requireSession();
  return createImportUploadUrl(session.user.id, fileName, mimeType);
}

export type CreateImportJobState = {
  status: "idle" | "error" | "success";
  message?: string;
  importJobId?: string;
  preview?: ImportPreview;
};

/**
 * Step 2 of 2: called once the browser has already PUT the file to `s3Key`.
 * This request body is just a handful of strings, never the file itself, so
 * it can't hit the same body-size problem.
 */
export async function createImportJobAction(input: {
  brokerAccountId: string;
  brokerCode: string;
  fileName: string;
  mimeType: string;
  s3Key: string;
}): Promise<CreateImportJobState> {
  const session = await requireSession();

  const lowerName = input.fileName.toLowerCase();
  if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
    return { status: "error", message: "Only .csv or .xlsx files are supported." };
  }
  const fileType: SupportedFileType = lowerName.endsWith(".xlsx") ? "xlsx" : "csv";

  try {
    const { importJobId, preview } = await createImportJobAndPreview({
      userId: session.user.id,
      brokerAccountId: input.brokerAccountId,
      brokerCode: input.brokerCode,
      fileName: input.fileName,
      fileType,
      mimeType: input.mimeType || "text/csv",
      s3Key: input.s3Key,
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
    });

    return { status: "success", importJobId, preview };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not process the file.",
    };
  }
}

export type ConfirmImportState = {
  status: "idle" | "error" | "success";
  message?: string;
  result?: ImportResult;
};

export async function confirmImportAction(
  _prevState: ConfirmImportState,
  formData: FormData
): Promise<ConfirmImportState> {
  const session = await requireSession();
  const importJobId = formData.get("importJobId");
  if (typeof importJobId !== "string" || !importJobId) {
    return { status: "error", message: "Missing import job." };
  }

  try {
    const result = await confirmImport(session.user.id, importJobId);
    revalidatePath("/dashboard");
    revalidatePath("/trading/trades");
    revalidatePath("/imports");
    return { status: "success", result };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Import failed.",
    };
  }
}

export type RollbackImportState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function rollbackImportAction(
  _prevState: RollbackImportState,
  formData: FormData
): Promise<RollbackImportState> {
  const session = await requireSession();
  const importJobId = formData.get("importJobId");
  if (typeof importJobId !== "string" || !importJobId) {
    return { status: "error", message: "Missing import job." };
  }

  try {
    await rollbackImportJob(session.user.id, importJobId);
    revalidatePath("/dashboard");
    revalidatePath("/trading/trades");
    revalidatePath("/imports");
    revalidatePath(`/imports/${importJobId}`);
    revalidatePath("/broker-accounts");
    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not undo this import.",
    };
  }
}
