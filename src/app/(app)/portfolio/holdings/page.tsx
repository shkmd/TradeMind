import { Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseNotice } from "@/components/shared/phase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR, formatPercent } from "@/lib/utils";

export default async function HoldingsPage() {
  const session = await requireSession();
  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: { instrument: true, brokerAccount: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Consolidated Holdings" description="Holdings consolidated across all connected broker accounts." />
      <PhaseNotice feature="Multi-broker ISIN consolidation and corporate-action adjustment" phase={3} />

      {holdings.length === 0 ? (
        <EmptyState icon={Wallet} title="No holdings yet" description="Delivery holdings will appear here once imported or entered manually." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Avg cost</TableHead>
                <TableHead>Current price</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Unrealised P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const qty = Number(h.quantity);
                const avgCost = Number(h.avgCostPrice);
                const current = h.currentPrice ? Number(h.currentPrice) : null;
                const value = current !== null ? current * qty : null;
                const unrealised = current !== null ? (current - avgCost) * qty : null;
                const unrealisedPct = current !== null ? ((current - avgCost) / avgCost) * 100 : null;
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.instrument.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">{h.brokerAccount.nickname}</TableCell>
                    <TableCell>{qty}</TableCell>
                    <TableCell>{formatINR(avgCost)}</TableCell>
                    <TableCell>{current !== null ? formatINR(current) : "—"}</TableCell>
                    <TableCell>{value !== null ? formatINR(value) : "—"}</TableCell>
                    <TableCell className={unrealised !== null && unrealised >= 0 ? "text-success" : "text-danger"}>
                      {unrealised !== null ? `${formatINR(unrealised)} (${formatPercent(unrealisedPct)})` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
