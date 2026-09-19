import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/rbac";
import { getTradeDetail } from "@/server/services/trade.service";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcessScoreBadge } from "@/components/trades/process-score-badge";
import { RuleCompliancePanel, type RuleEvaluationRow } from "@/components/trades/rule-compliance-panel";
import { TradeJournalForm } from "@/components/trades/trade-journal-form";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [trade, emotions] = await Promise.all([
    getTradeDetail(session.user.id, id),
    prisma.emotion.findMany({ orderBy: { label: "asc" } }),
  ]);
  if (!trade) notFound();

  const ruleEvaluations: RuleEvaluationRow[] = trade.ruleEvaluations.map((re) => ({
    id: re.id,
    ruleName: re.rule.name,
    result: re.result,
    violationCost: re.violation?.financialCost ? Number(re.violation.financialCost) : null,
  }));

  const netPnl = trade.netPnl ? Number(trade.netPnl) : null;

  return (
    <div>
      <PageHeader
        title={`${trade.instrument.symbol} · ${trade.side}`}
        description={`${trade.brokerAccount.broker.name} — ${trade.brokerAccount.nickname} · ${trade.productType}`}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Trade summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <SummaryRow label="Status" value={<Badge variant="secondary">{trade.status.replace("_", " ")}</Badge>} />
            <SummaryRow label="Quantity" value={trade.quantity} />
            <SummaryRow label="Entry avg" value={formatINR(trade.entryAvgPrice.toString())} />
            <SummaryRow label="Exit avg" value={trade.exitAvgPrice ? formatINR(trade.exitAvgPrice.toString()) : "—"} />
            <SummaryRow label="Opened" value={formatDateTime(trade.openedAt)} />
            <SummaryRow label="Closed" value={trade.closedAt ? formatDateTime(trade.closedAt) : "—"} />
            <SummaryRow
              label="Gross P&L"
              value={
                <span className={Number(trade.grossPnl ?? 0) >= 0 ? "text-success" : "text-danger"}>
                  {trade.grossPnl ? formatINR(trade.grossPnl.toString()) : "—"}
                </span>
              }
            />
            <SummaryRow label="Total charges" value={trade.totalCharges ? formatINR(trade.totalCharges.toString()) : "—"} />
            <SummaryRow
              label="Net P&L"
              value={
                <span className={cn(netPnl !== null && netPnl >= 0 ? "text-success" : "text-danger")}>
                  {netPnl !== null ? formatINR(netPnl) : "—"}
                </span>
              }
            />
          </CardContent>
        </Card>

        <ProcessScoreBadge score={trade.processScore} label="Process score" />
        <ProcessScoreBadge score={trade.ruleComplianceScore} label="Rule compliance %" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trade.tradeExecutions.map((te) => (
                  <TableRow key={te.id}>
                    <TableCell>{formatDateTime(te.execution.executedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={te.role === "ENTRY" ? "success" : "warning"}>{te.role}</Badge>
                    </TableCell>
                    <TableCell>{te.matchedQuantity}</TableCell>
                    <TableCell>{formatINR(te.execution.price.toString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Charge breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChargeBreakdownTable breakdown={trade.chargeBreakdown as Record<string, number> | null} />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Rule compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <RuleCompliancePanel evaluations={ruleEvaluations} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade journal</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeJournalForm
            emotions={emotions}
            values={{
              tradeId: trade.id,
              setupNotes: trade.journal?.setupNotes ?? null,
              entryReason: trade.journal?.entryReason ?? null,
              plannedStopLoss: trade.journal?.plannedStopLoss ? Number(trade.journal.plannedStopLoss) : null,
              plannedTarget: trade.journal?.plannedTarget ? Number(trade.journal.plannedTarget) : null,
              confidenceLevel: trade.journal?.confidenceLevel ?? null,
              exitReason: trade.journal?.exitReason ?? null,
              setupFollowed: trade.journal?.setupFollowed ?? null,
              stopLossFollowed: trade.journal?.stopLossFollowed ?? null,
              whatWentWell: trade.journal?.whatWentWell ?? null,
              whatWentWrong: trade.journal?.whatWentWrong ?? null,
              lessonLearned: trade.journal?.lessonLearned ?? null,
              rating: trade.journal?.rating ?? null,
              emotionId: trade.journal?.emotionId ?? null,
              completedAt: trade.journal?.completedAt?.toISOString() ?? null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </>
  );
}

function ChargeBreakdownTable({ breakdown }: { breakdown: Record<string, number> | null }) {
  if (!breakdown) return <p className="text-sm text-muted-foreground">No charges computed.</p>;
  const labels: Record<string, string> = {
    turnover: "Turnover",
    brokerage: "Brokerage",
    sttCtt: "STT/CTT",
    exchangeTxnCharge: "Exchange charges",
    sebiCharges: "SEBI charges",
    stampDuty: "Stamp duty",
    gst: "GST",
  };
  return (
    <dl className="space-y-1.5 text-sm">
      {Object.entries(labels).map(([key, label]) => (
        <div key={key} className="flex justify-between">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{formatINR(breakdown[key] ?? 0)}</dd>
        </div>
      ))}
    </dl>
  );
}
