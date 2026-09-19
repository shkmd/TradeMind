import { Receipt } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, formatPercent } from "@/lib/utils";

export default async function ChargesAnalysisPage() {
  const session = await requireSession();
  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: { instrument: true, brokerAccount: true },
  });

  if (trades.length === 0) {
    return (
      <div>
        <PageHeader title="Charges Analysis" description="Where your trading rupee goes: brokerage, STT, GST and more." />
        <EmptyState icon={Receipt} title="No trades yet" description="Import trades to see your charges breakdown." />
      </div>
    );
  }

  const grossPnl = trades.reduce((sum: number, t) => sum + Number(t.grossPnl ?? 0), 0);
  const totalCharges = trades.reduce((sum: number, t) => sum + Number(t.totalCharges ?? 0), 0);
  const chargesPctOfGross = grossPnl !== 0 ? (totalCharges / Math.abs(grossPnl)) * 100 : null;

  const byBroker = new Map<string, number>();
  const byInstrument = new Map<string, number>();
  const componentTotals: Record<string, number> = {};

  for (const t of trades) {
    byBroker.set(t.brokerAccount.nickname, (byBroker.get(t.brokerAccount.nickname) ?? 0) + Number(t.totalCharges ?? 0));
    byInstrument.set(t.instrument.symbol, (byInstrument.get(t.instrument.symbol) ?? 0) + Number(t.totalCharges ?? 0));

    const breakdown = t.chargeBreakdown as Record<string, number> | null;
    if (breakdown) {
      for (const [key, value] of Object.entries(breakdown)) {
        if (key === "turnover") continue;
        componentTotals[key] = (componentTotals[key] ?? 0) + value;
      }
    }
  }

  const COMPONENT_LABELS: Record<string, string> = {
    brokerage: "Brokerage",
    sttCtt: "STT/CTT",
    exchangeTxnCharge: "Exchange charges",
    sebiCharges: "SEBI charges",
    stampDuty: "Stamp duty",
    gst: "GST",
  };

  return (
    <div>
      <PageHeader title="Charges Analysis" description="Where your trading rupee goes: brokerage, STT, GST and more." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Total charges</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="financial-figure text-2xl">{formatINR(totalCharges)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Gross P&amp;L</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="financial-figure text-2xl">{formatINR(grossPnl)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Charges as % of gross profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="financial-figure text-2xl">{formatPercent(chargesPctOfGross)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {Object.entries(componentTotals).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{COMPONENT_LABELS[key] ?? key}</span>
                <span className="font-medium">{formatINR(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By broker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {Array.from(byBroker.entries()).map(([name, value]) => (
              <div key={name} className="flex justify-between">
                <span className="text-muted-foreground">{name}</span>
                <span className="font-medium">{formatINR(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By instrument</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {Array.from(byInstrument.entries()).map(([symbol, value]) => (
              <div key={symbol} className="flex justify-between">
                <span className="text-muted-foreground">{symbol}</span>
                <span className="font-medium">{formatINR(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
