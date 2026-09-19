import { requireSession } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm, SecurityForm } from "./settings-forms";

export default async function SettingsPage() {
  const session = await requireSession();
  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile, risk limits and account security." />
      <ProfileForm
        displayName={profile?.displayName ?? session.user.name ?? ""}
        startingCapital={profile?.startingCapital ? Number(profile.startingCapital) : null}
        maxRiskPerTradePct={profile?.maxRiskPerTradePct ? Number(profile.maxRiskPerTradePct) : null}
        maxDailyLossAmount={profile?.maxDailyLossAmount ? Number(profile.maxDailyLossAmount) : null}
        maxTradesPerDay={profile?.maxTradesPerDay ?? null}
      />
      <SecurityForm />
    </div>
  );
}
