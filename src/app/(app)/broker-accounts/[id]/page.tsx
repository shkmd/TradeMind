import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { getBrokerAccount } from "@/server/services/broker-account.service";
import { getApiConnector, getDirectLoginConnector } from "@/lib/brokers/api-connector-registry";
import { deleteBrokerAccountAction } from "@/server/actions/broker-accounts";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveConnectCard } from "@/components/broker-accounts/live-connect-card";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default async function BrokerAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connectError?: string; connected?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { connectError, connected } = await searchParams;
  const account = await getBrokerAccount(session.user.id, id);
  if (!account) notFound();

  const redirectConnector = getApiConnector(account.broker.code);
  const directConnector = getDirectLoginConnector(account.broker.code);
  const connectorKind: "redirect" | "direct" | null = redirectConnector ? "redirect" : directConnector ? "direct" : null;
  const isLiveConfigured = redirectConnector?.isConfigured() ?? directConnector?.isConfigured() ?? false;
  // A broker account can have both a CSV_IMPORT connection (created when the
  // account was added) and a separate API_OAUTH one — only the latter
  // reflects a live session.
  const liveConnection = account.connections.find((c) => c.connectionType === "API_OAUTH") ?? null;

  return (
    <div>
      <PageHeader
        title={account.nickname}
        description={`${account.broker.name} · ${account.accountType.replace("_", " ").toLowerCase()}`}
        actions={
          account.broker.isImplemented ? (
            <Button asChild size="sm">
              <Link href={`/imports/new?brokerAccountId=${account.id}`}>
                <Upload className="mr-1.5 h-4 w-4" />
                Import Tradebook
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Starting capital</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="financial-figure text-xl">
              {account.startingCapital ? formatINR(account.startingCapital.toString()) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={account.isActive ? "success" : "secondary"}>
              {account.isActive ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Connected since</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatDate(account.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {connectorKind && (
        <div className="mb-6">
          <LiveConnectCard
            brokerAccountId={account.id}
            brokerCode={account.broker.code}
            connectorKind={connectorKind}
            isConfigured={isLiveConfigured}
            connectionStatus={liveConnection?.status ?? null}
            lastSyncedAt={liveConnection?.lastSyncedAt ?? null}
            connectError={connectError}
            justConnected={connected === "1"}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import history</CardTitle>
        </CardHeader>
        <CardContent>
          {account.importJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet for this account.</p>
          ) : (
            <ul className="divide-y divide-surface-border">
              {account.importJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/imports/${job.id}`}
                    className="flex items-center justify-between py-2.5 text-sm hover:bg-surface-muted"
                  >
                    <div>
                      <p className="font-medium">{job.reportType.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(job.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{job.tradesGenerated} trades</span>
                      <span>{job.duplicateRows} duplicates</span>
                      <Badge variant={job.status === "COMPLETED" ? "success" : job.status === "FAILED" ? "danger" : "secondary"}>
                        {job.status}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Permanently removes this broker account along with all its imports, trades and executions. This cannot be
            undone from the app — you would need to reconnect and re-import from scratch.
          </p>
          <ConfirmDeleteButton
            action={deleteBrokerAccountAction}
            hiddenFields={{ brokerAccountId: account.id }}
            triggerLabel="Delete broker account"
            title={`Delete ${account.nickname}?`}
            description="This permanently removes this broker account and every trade, execution and import associated with it. This cannot be undone from the app."
            confirmLabel="Delete account"
          />
        </CardContent>
      </Card>
    </div>
  );
}
