import Link from "next/link";
import { Upload } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { listImportJobs } from "@/server/services/import.service";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "secondary"> = {
  COMPLETED: "success",
  FAILED: "danger",
  REVIEW: "warning",
};

export default async function ImportsPage() {
  const session = await requireSession();
  const jobs = await listImportJobs(session.user.id);

  return (
    <div>
      <PageHeader
        title="Imports"
        description="History of every broker file you've imported, with reconciliation status."
        actions={
          <Button asChild size="sm">
            <Link href="/imports/new">
              <Upload className="mr-1.5 h-4 w-4" />
              New import
            </Link>
          </Button>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No imports yet"
          description="Import a Zerodha tradebook to generate your first trades and see them on the dashboard."
          action={
            <Button asChild>
              <Link href="/imports/new">Start an import</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/imports/${job.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {job.brokerAccount.broker.name} — {job.brokerAccount.nickname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.reportType.replace("_", " ")} · {formatDateTime(job.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{job.totalRows} rows</span>
                    <span>{job.tradesGenerated} trades</span>
                    <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>{job.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
