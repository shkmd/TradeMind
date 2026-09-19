import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  { key: "FREE", name: "Free", price: "₹0", features: ["1 account", "Manual trades & holdings", "Basic analytics", "Limited journal"] },
  { key: "STARTER", name: "Starter", price: "₹199/mo", features: ["3 broker accounts", "CSV imports", "Consolidated portfolio", "Complete performance analytics"] },
  { key: "PRO", name: "Pro", price: "₹399/mo", features: ["Unlimited accounts", "AI coach", "Behavioural Loss Engine", "Trading-rule engine", "Scenario simulator"] },
  { key: "MENTOR", name: "Mentor", price: "₹999/mo", features: ["Multiple invited traders", "Comments", "Assigned reviews", "Shared reports"] },
] as const;

export default async function BillingPage() {
  const session = await requireSession();
  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Razorpay subscriptions run in test mode. No live charges occur in this build."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Badge variant="insight" className="text-sm">
            {subscription?.plan ?? "FREE"}
          </Badge>
          <span className="text-sm text-muted-foreground">Status: {subscription?.status ?? "ACTIVE"}</span>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <Card key={plan.key} className={cn(subscription?.plan === plan.key && "border-primary")}>
            <CardHeader>
              <CardTitle className="text-foreground">{plan.name}</CardTitle>
              <p className="font-serif text-2xl">{plan.price}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant={subscription?.plan === plan.key ? "secondary" : "outline"} disabled>
                {subscription?.plan === plan.key ? "Current plan" : "Razorpay checkout (coming soon)"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
