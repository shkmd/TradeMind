"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/rbac";
import { uploadAndPreviewImport, confirmImport, rollbackImportJob } from "@/server/services/import.service";
import type { ImportPreview } from "@/lib/import/preview";
import type { ImportResult } from "@/lib/import/pipeline";

export type UploadImportState = {
  status: "idle" | "error" | "success";
  message?: string;
  importJobId?: string;
  preview?: ImportPreview;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function uploadImportAction(
  _prevState: UploadImportState,
  formData: FormData
): Promise<UploadImportState> {
  const session = await requireSession();

  const brokerAccountId = formData.get("brokerAccountId");
  const brokerCode = formData.get("brokerCode");
  const file = formData.get("file");

  if (typeof brokerAccountId !== "string" || typeof brokerCode !== "string" || !brokerAccountId || !brokerCode) {
    // Temporary diagnostic: this check has been failing for at least one
    // real user despite the hidden inputs looking correct in SSR HTML and a
    // fresh end-to-end repro working fine. Logging exactly what FormData
    // actually contained server-side, to tell a genuinely-empty field apart
    // from something odder (wrong key name, a stale/duplicate field, etc).
    console.error("[uploadImportAction] Missing broker account — FormData keys received:", {
      keys: Array.from(formData.keys()),
      brokerAccountId,
      brokerCode,
      userId: session.user.id,
    });
    return { status: "error", message: "Missing broker account." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Select a Tradebook file to upload." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { status: "error", message: "File is too large (max 10MB)." };
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
    return { status: "error", message: "Only .csv or .xlsx files are supported." };
  }
  const fileType = lowerName.endsWith(".xlsx") ? "xlsx" : "csv";

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { importJobId, preview } = await uploadAndPreviewImport({
      userId: session.user.id,
      brokerAccountId,
      brokerCode,
      fileName: file.name,
      fileType,
      mimeType: file.type || "text/csv",
      buffer,
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
