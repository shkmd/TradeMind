import { FileText } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "secondary"> = {
  ACTIVE: "success",
  STRENGTHENING: "success",
  UNDER_REVIEW: "warning",
  WEAKENING: "warning",
  BROKEN: "danger",
  EXITED: "secondary",
};

export default async function InvestmentThesesPage() {
  const session = await requireSession();
  const theses = await prisma.investmentThesis.findMany({
    where: { userId: session.user.id },
    include: { holding: { include: { instrument: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Investment Thesis" description="The reasoning behind every long-term holding, reviewed periodically." />
      {theses.length === 0 ? (
        <EmptyState icon={FileText} title="No investment theses yet" description="Attach a thesis to a holding to track why you own it and when to reconsider." />
      ) : (
        <div className="space-y-3">
          {theses.map((thesis) => (
            <Card key={thesis.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-foreground">{thesis.holding.instrument.symbol}</CardTitle>
                <Badge variant={STATUS_VARIANT[thesis.status] ?? "secondary"}>{thesis.status.replace("_", " ")}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {thesis.thesis && <p>{thesis.thesis}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {thesis.risks && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Risks: </span>
                      {thesis.risks}
                    </p>
                  )}
                  {thesis.exitConditions && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Exit if: </span>
                      {thesis.exitConditions}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
