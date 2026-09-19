import Link from "next/link";
import { Link2, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { listBrokerAccounts } from "@/server/services/broker-account.service";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/utils";

export default async function BrokerAccountsPage() {
  const session = await requireSession();
  const accounts = await listBrokerAccounts(session.user.id);

  return (
    <div>
      <PageHeader
        title="Broker Accounts"
        description="Connect and manage every broker account you trade or invest through."
        actions={
          <Button asChild size="sm">
            <Link href="/broker-accounts/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add broker account
            </Link>
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No broker accounts yet"
          description="Add your first broker account — manually, or by importing a Zerodha tradebook — to start consolidating your trades."
          action={
            <Button asChild>
              <Link href="/broker-accounts/new">Add broker account</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link key={account.id} href={`/broker-accounts/${account.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{account.nickname}</p>
                      <p className="text-xs text-muted-foreground">{account.broker.name}</p>
                    </div>
                    <Badge variant={account.isActive ? "success" : "secondary"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <dt>Starting capital</dt>
                      <dd className="font-medium text-foreground">
                        {account.startingCapital ? formatINR(account.startingCapital.toString()) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Trades</dt>
                      <dd className="font-medium text-foreground">{account._count.trades}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Connected since</dt>
                      <dd className="font-medium text-foreground">{formatDate(account.createdAt)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
