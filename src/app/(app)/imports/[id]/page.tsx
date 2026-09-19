import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/rbac";
import { getImportJob } from "@/server/services/import.service";
import { rollbackImportAction } from "@/server/actions/imports";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { formatDateTime } from "@/lib/utils";

const ROW_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "secondary"> = {
  IMPORTED: "success",
  INVALID: "danger",
  DUPLICATE: "warning",
};

export default async function ImportJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const job = await getImportJob(session.user.id, id);
  if (!job) notFound();

  return (
    <div>
      <PageHeader
        title={`${job.brokerAccount.broker.name} import`}
        description={`${job.brokerAccount.nickname} · ${formatDateTime(job.createdAt)}`}
        actions={
          job.status !== "ROLLED_BACK" ? (
            <ConfirmDeleteButton
              action={rollbackImportAction}
              hiddenFields={{ importJobId: job.id }}
              triggerLabel="Undo this import"
              title="Undo this import?"
              description="This removes every trade/execution this import created and marks it rolled back. Other imports for this broker account are unaffected. This cannot be undone automatically — you'd need to re-upload the file."
              confirmLabel="Undo import"
            />
          ) : (
            <Badge variant="secondary">Rolled back</Badge>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Status" value={<Badge variant={job.status === "COMPLETED" ? "success" : "secondary"}>{job.status}</Badge>} />
        <Stat label="Total rows" value={job.totalRows} />
        <Stat label="Imported" value={job.validRows} />
        <Stat label="Duplicates" value={job.duplicateRows} />
        <Stat label="Trades generated" value={job.tradesGenerated} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Row-level detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[32rem] overflow-y-auto rounded-md border border-surface-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>
                      <Badge variant={ROW_STATUS_VARIANT[row.status] ?? "secondary"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Array.isArray(row.errors) ? (row.errors as string[]).join("; ") : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-surface-border bg-surface px-3 py-2">
      <div className="financial-figure text-lg">{value}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
