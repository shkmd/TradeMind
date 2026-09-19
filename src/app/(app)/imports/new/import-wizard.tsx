"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileWarning, UploadCloud, XCircle } from "lucide-react";
import {
  getImportUploadUrlAction,
  createImportJobAction,
  confirmImportAction,
  type CreateImportJobState,
  type ConfirmImportState,
} from "@/server/actions/imports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/utils";

const uploadInitialState: CreateImportJobState = { status: "idle" };
const confirmInitialState: ConfirmImportState = { status: "idle" };

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — also enforced server-side

type Step = "upload" | "review" | "summary";

export function ImportWizard({
  brokerAccountId,
  brokerCode,
  brokerName,
}: {
  brokerAccountId: string;
  brokerCode: string;
  brokerName: string;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<CreateImportJobState>(uploadInitialState);
  const [isUploading, startUploadTransition] = useTransition();
  const [confirmState, confirmFormAction, isConfirming] = useActionState(confirmImportAction, confirmInitialState);

  useEffect(() => {
    if (uploadState.status === "success") setStep("review");
  }, [uploadState.status]);

  useEffect(() => {
    if (confirmState.status === "success") setStep("summary");
  }, [confirmState.status]);

  function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) {
      setUploadState({ status: "error", message: "Select a Tradebook file to upload." });
      return;
    }
    if (selectedFile.size === 0) {
      setUploadState({ status: "error", message: "Select a Tradebook file to upload." });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setUploadState({ status: "error", message: "File is too large (max 10MB)." });
      return;
    }

    const file = selectedFile;
    startUploadTransition(async () => {
      try {
        // The file goes straight from the browser to storage via a signed
        // URL — not through this server's request body. See the doc comment
        // on getSignedImportUploadUrl (src/lib/storage/s3.ts) for why: a
        // real ~11,000-row file sent as a server-action multipart body
        // arrived at the server as a completely empty FormData in
        // production, most likely a proxy-level body size limit ahead of
        // the app truncating it before Next.js ever saw it.
        const mimeType = file.type || "text/csv";
        const { uploadUrl, s3Key } = await getImportUploadUrlAction(file.name, mimeType);

        const putResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": mimeType },
        });
        if (!putResponse.ok) {
          throw new Error("Upload to storage failed. Please try again.");
        }

        const result = await createImportJobAction({
          brokerAccountId,
          brokerCode,
          fileName: file.name,
          mimeType,
          s3Key,
        });
        setUploadState(result);
      } catch (error) {
        setUploadState({
          status: "error",
          message: error instanceof Error ? error.message : "Upload failed. Please try again.",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Steps current={step} />

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>1–2. Select broker &amp; upload file</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="rounded-md border border-surface-border bg-surface-muted px-3 py-2 text-sm">
                Broker: <span className="font-medium">{brokerName}</span> · Report type:{" "}
                <span className="font-medium">Tradebook</span>
              </div>

              <label
                htmlFor="file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface px-6 py-10 text-center hover:bg-surface-muted"
              >
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                {selectedFile ? (
                  <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
                ) : (
                  <span className="text-sm font-medium">Click to select a .csv or .xlsx file</span>
                )}
                <span className="text-xs text-muted-foreground">{reportLocationHint(brokerCode)}</span>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {uploadState.status === "error" && uploadState.message && (
                <p className="text-sm font-medium text-destructive">{uploadState.message}</p>
              )}

              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading ? "Uploading & validating…" : "Upload and preview"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "review" && uploadState.status === "success" && uploadState.preview && uploadState.importJobId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>3–9. Preview, validate &amp; check duplicates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <StatBlock label="Valid rows" value={uploadState.preview.validRows} tone="positive" />
                <StatBlock label="Duplicate rows" value={uploadState.preview.duplicateRows} tone="warning" />
                <StatBlock label="Invalid rows" value={uploadState.preview.invalidRows} tone="negative" />
              </div>

              <div className="max-h-96 overflow-y-auto rounded-md border border-surface-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadState.preview.rows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.symbol ?? "—"}</TableCell>
                        <TableCell>{row.side ?? "—"}</TableCell>
                        <TableCell>{row.quantity ?? "—"}</TableCell>
                        <TableCell>{row.price ? formatINR(row.price) : "—"}</TableCell>
                        <TableCell>
                          <RowStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {row.errors.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-sm text-muted-foreground">
                {uploadState.preview.validRows} new executions will be imported. Duplicate and invalid rows are
                skipped automatically.
              </p>
              <form action={confirmFormAction}>
                <input type="hidden" name="importJobId" value={uploadState.importJobId} />
                <Button type="submit" disabled={isConfirming || uploadState.preview.validRows === 0}>
                  {isConfirming ? "Importing…" : "Confirm import"}
                </Button>
              </form>
            </CardContent>
          </Card>
          {confirmState.status === "error" && confirmState.message && (
            <p className="text-sm font-medium text-destructive">{confirmState.message}</p>
          )}
        </>
      )}

      {step === "summary" && confirmState.status === "success" && confirmState.result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Import complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="Rows processed" value={confirmState.result.totalRows} />
              <StatBlock label="Imported" value={confirmState.result.validRows} tone="positive" />
              <StatBlock label="Duplicates skipped" value={confirmState.result.duplicateRows} tone="warning" />
              <StatBlock label="Trades generated" value={confirmState.result.tradesGenerated} tone="positive" />
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/trading/trades">View trades</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "review", label: "Validate & dedupe" },
    { key: "summary", label: "Summary" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      {steps.map((s, idx) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={
              idx <= currentIndex
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                : "flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            }
          >
            {idx + 1}
          </span>
          <span className={idx <= currentIndex ? "text-foreground" : ""}>{s.label}</span>
          {idx < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function StatBlock({ label, value, tone }: { label: string; value: number; tone?: "positive" | "negative" | "warning" }) {
  return (
    <div className="rounded-md border border-surface-border bg-surface-muted px-3 py-2">
      <p
        className={
          "financial-figure text-xl " +
          (tone === "positive" ? "text-success" : tone === "negative" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function RowStatusBadge({ status }: { status: "VALID" | "INVALID" | "DUPLICATE" }) {
  if (status === "VALID") return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Valid</Badge>;
  if (status === "DUPLICATE") return <Badge variant="warning"><FileWarning className="mr-1 h-3 w-3" />Duplicate</Badge>;
  return <Badge variant="danger"><XCircle className="mr-1 h-3 w-3" />Invalid</Badge>;
}

function reportLocationHint(brokerCode: string): string {
  const hints: Record<string, string> = {
    ZERODHA: "Zerodha Console → Reports → Tradebook",
    DHAN: "web.dhan.co → Reports → Trade History",
    UPSTOX: "Upstox Pro Web → Reports → Trade History",
    ANGEL_ONE: "Angel One Web → Download Reports → Trades and Charges (.xlsx only — equity and F&O supported)",
    KOTAK: "Kotak Neo → Reports → Trade Report",
  };
  return hints[brokerCode] ?? "Your broker's tradebook / trade-history export";
}
