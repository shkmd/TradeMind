import { ScrollText } from "lucide-react";
import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RULE_TYPE_LABELS: Record<string, string> = {
  MAX_TRADES_PER_DAY: "Maximum trades per day",
  MAX_LOSS_PER_TRADE_PERCENT: "Maximum loss per trade (%)",
  JOURNAL_COMPLETION_REQUIRED: "Journal completion required",
  MIN_RISK_REWARD_RATIO: "Minimum risk-reward ratio",
};

export default async function TradingRulesPage() {
  const session = await requireSession();
  const rules = await prisma.tradingRule.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { evaluations: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Trading Rules"
        description="Every closed trade is automatically evaluated against your active rules."
      />
      {rules.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No trading rules configured"
          description="Rules are set up during onboarding. Rule creation/editing UI is coming in a later release."
        />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType} · {rule.scope}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{rule._count.evaluations} evaluations</span>
                  <Badge variant={rule.isActive ? "success" : "secondary"}>{rule.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
