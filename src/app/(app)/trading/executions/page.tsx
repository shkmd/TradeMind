import { GitBranch } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatINR } from "@/lib/utils";

export default async function ExecutionsPage() {
  const session = await requireSession();
  const executions = await prisma.execution.findMany({
    where: { brokerAccount: { userId: session.user.id }, deletedAt: null },
    include: { instrument: true, brokerAccount: true },
    orderBy: { executedAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Executions" description="Every immutable broker fill imported into TradeMind India." />
      {executions.length === 0 ? (
        <EmptyState icon={GitBranch} title="No executions yet" description="Import a tradebook to see raw broker fills here." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Broker account</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Trade ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDateTime(e.executedAt)}</TableCell>
                  <TableCell>{e.brokerAccount.nickname}</TableCell>
                  <TableCell>{e.instrument.symbol}</TableCell>
                  <TableCell>
                    <Badge variant={e.side === "BUY" ? "success" : "danger"}>{e.side}</Badge>
                  </TableCell>
                  <TableCell>{e.quantity}</TableCell>
                  <TableCell>{formatINR(e.price.toString())}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.brokerTradeId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
