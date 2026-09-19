import { FileSpreadsheet } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/utils";

export default async function ReportsPage() {
  const session = await requireSession();
  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: { brokerAccount: { include: { broker: true } } },
  });

  if (trades.length === 0) {
    return (
      <div>
        <PageHeader title="Reports & Tax" description="Broker-wise, segment-wise P&L and charges summaries." />
        <EmptyState icon={FileSpreadsheet} title="No trades yet" description="Import trades to generate reports." />
      </div>
    );
  }

  const byBroker = new Map<string, { gross: number; charges: number; net: number; count: number }>();
  for (const t of trades) {
    const key = `${t.brokerAccount.broker.name} — ${t.brokerAccount.nickname}`;
    const entry = byBroker.get(key) ?? { gross: 0, charges: 0, net: 0, count: 0 };
    entry.gross += Number(t.grossPnl ?? 0);
    entry.charges += Number(t.totalCharges ?? 0);
    entry.net += Number(t.netPnl ?? 0);
    entry.count += 1;
    byBroker.set(key, entry);
  }

  return (
    <div>
      <PageHeader
        title="Reports & Tax"
        description="Financial year 2024-25 (April–March). Broker-wise P&L below is generated from your real imported trades."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Export PDF
            </Button>
            <Button variant="outline" size="sm" disabled>
              Export Excel
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Broker-wise P&amp;L summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broker account</TableHead>
                <TableHead>Trades</TableHead>
                <TableHead>Gross P&amp;L</TableHead>
                <TableHead>Charges</TableHead>
                <TableHead>Net P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(byBroker.entries()).map(([name, s]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{s.count}</TableCell>
                  <TableCell>{formatINR(s.gross)}</TableCell>
                  <TableCell>{formatINR(s.charges)}</TableCell>
                  <TableCell className={s.net >= 0 ? "text-success" : "text-danger"}>{formatINR(s.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-md border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning-foreground">
        Tax values shown are informational estimates only and must be verified by a qualified Chartered Accountant.
        STCG/LTCG classification, turnover-based business-income treatment, and full PDF/Excel/CSV exports ship in a
        later phase.
      </div>
    </div>
  );
}
