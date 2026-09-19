import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function RiskDashboardPage() {
  const session = await requireSession();
  const [profile, todaysTrades] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.trade.findMany({
      where: { userId: session.user.id, openedAt: { gte: startOfToday() } },
    }),
  ]);

  const todaysLoss = todaysTrades
    .filter((t) => Number(t.netPnl ?? 0) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.netPnl ?? 0)), 0);
  const maxDailyLoss = profile?.maxDailyLossAmount ? Number(profile.maxDailyLossAmount) : null;
  const maxTradesPerDay = profile?.maxTradesPerDay ?? null;

  const lossStatus = riskStatus(todaysLoss, maxDailyLoss);
  const tradeCountStatus = riskStatus(todaysTrades.length, maxTradesPerDay);
  const overallStatus = worstOf([lossStatus, tradeCountStatus]);

  return (
    <div>
      <PageHeader title="Risk Dashboard" description="Your configured limits, checked against today's activity." />

      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Overall risk status:</span>
        <StatusBadge status={overallStatus} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle>Today&apos;s loss vs. daily limit</CardTitle>
            <StatusBadge status={lossStatus} />
          </CardHeader>
          <CardContent>
            <p className="financial-figure text-2xl">
              {formatINR(todaysLoss)} <span className="text-sm text-muted-foreground">/ {maxDailyLoss !== null ? formatINR(maxDailyLoss) : "—"}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle>Trades today vs. max/day</CardTitle>
            <StatusBadge status={tradeCountStatus} />
          </CardHeader>
          <CardContent>
            <p className="financial-figure text-2xl">
              {todaysTrades.length} <span className="text-sm text-muted-foreground">/ {maxTradesPerDay ?? "—"}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <PhaseNotice feature="Drawdown tracking, risk of ruin and safe position sizing" phase={4} />
    </div>
  );
}

type Status = "green" | "amber" | "red";

function riskStatus(current: number, limit: number | null): Status {
  if (limit === null || limit === 0) return "green";
  const ratio = current / limit;
  if (ratio >= 1) return "red";
  if (ratio >= 0.75) return "amber";
  return "green";
}

function worstOf(statuses: Status[]): Status {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("amber")) return "amber";
  return "green";
}

function StatusBadge({ status }: { status: Status }) {
  const config = {
    green: { label: "Within limits", cls: "bg-success-muted text-success-foreground" },
    amber: { label: "Approaching limit", cls: "bg-warning-muted text-warning-foreground" },
    red: { label: "Limit exceeded", cls: "bg-danger-muted text-danger-foreground" },
  }[status];
  return <Badge className={cn("border-transparent", config.cls)}>{config.label}</Badge>;
}
