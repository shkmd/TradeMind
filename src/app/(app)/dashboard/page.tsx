import Link from "next/link";
import { AlertTriangle, LineChart as LineChartIcon, Link2, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { getDashboardData } from "@/server/services/dashboard.service";
import { listBrokerAccounts } from "@/server/services/broker-account.service";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EquityCurveChart } from "@/components/dashboard/equity-curve-chart";
import { PnlByInstrumentChart } from "@/components/dashboard/pnl-by-instrument-chart";
import { DashboardDateFilter } from "@/components/dashboard/date-range-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatPercent } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ brokerAccountId?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const from = params.from ? new Date(`${params.from}T00:00:00`) : undefined;
  const to = params.to ? new Date(`${params.to}T23:59:59`) : undefined;

  const [data, brokerAccounts] = await Promise.all([
    getDashboardData(session.user.id, { brokerAccountId: params.brokerAccountId, from, to }),
    listBrokerAccounts(session.user.id),
  ]);

  if (brokerAccounts.length === 0) {
    return (
      <div>
        <PageHeader title="Overview" description="Your trading journal and portfolio, consolidated." />
        <EmptyState
          icon={Link2}
          title="Connect a broker account to get started"
          description="Add a broker account and import your tradebook to see your consolidated dashboard, trades and process score."
          action={
            <Button asChild>
              <Link href="/broker-accounts/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Add broker account
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Consolidated across all connected brokers unless filtered below."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/imports/new">Import trades</Link>
          </Button>
        }
      />

      <DashboardDateFilter />

      {data.behaviouralWarning && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{data.behaviouralWarning}</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Realized P&L"
          value={formatINR(data.realizedPnl)}
          tone={data.realizedPnl >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Net P&L (after charges)"
          value={formatINR(data.netPnl)}
          tone={data.netPnl >= 0 ? "positive" : "negative"}
        />
        <KpiCard label="Total Charges" value={formatINR(data.totalCharges)} tone="neutral" />
        <KpiCard
          label="Today's P&L"
          value={formatINR(data.todaysPnl)}
          tone={data.todaysPnl >= 0 ? "positive" : "negative"}
        />
        <KpiCard label="Win Rate" value={formatPercent(data.winRate)} sublabel={`${data.closedTradeCount} closed trades`} />
        <KpiCard label="Trade Count" value={String(data.tradeCount)} />
        <KpiCard
          label="Avg Process Score"
          value={data.avgProcessScore !== null ? Math.round(data.avgProcessScore).toString() : "—"}
          tone={data.avgProcessScore !== null && data.avgProcessScore < 60 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Avg Rule Compliance"
          value={data.avgRuleCompliance !== null ? formatPercent(data.avgRuleCompliance, 0) : "—"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consolidated equity curve</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityCurveChart data={data.equityCurve} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net P&L by instrument</CardTitle>
          </CardHeader>
          <CardContent>
            <PnlByInstrumentChart data={data.pnlByInstrument} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected brokers</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.connectedBrokerAccounts.map((account) => (
            <Badge key={account.id} variant="secondary" className="gap-1.5 py-1.5">
              <LineChartIcon className="h-3 w-3" />
              {account.brokerName} — {account.nickname}
            </Badge>
          ))}
          <Button asChild variant="ghost" size="sm">
            <Link href="/broker-accounts/new">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add another
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
