"use server";

import { requireSession } from "@/lib/auth/rbac";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { completeOnboarding } from "@/server/services/onboarding.service";
import { seedDemoDataForUser } from "@/server/services/demo-data.service";

export type OnboardingActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  redirectTo?: string;
};

export async function onboardingAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const session = await requireSession();

  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    fyStartMonth: formData.get("fyStartMonth"),
    experienceLevel: formData.get("experienceLevel"),
    traderProfileType: formData.get("traderProfileType"),
    startingCapital: formData.get("startingCapital"),
    maxRiskPerTradePct: formData.get("maxRiskPerTradePct"),
    maxDailyLossAmount: formData.get("maxDailyLossAmount"),
    maxTradesPerDay: formData.get("maxTradesPerDay"),
    minRiskRewardRatio: formData.get("minRiskRewardRatio"),
    dataChoice: formData.get("dataChoice"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  await completeOnboarding(session.user.id, parsed.data);

  if (parsed.data.dataChoice === "DEMO") {
    await seedDemoDataForUser(session.user.id);
    return { status: "success", redirectTo: "/dashboard" };
  }

  // Deliberately not next/navigation's redirect() here: this action can
  // only mark onboarding complete in the DB, but the caller's JWT session
  // cookie still says onboardingCompleted=false until the client refreshes
  // it (see onboarding/page.tsx calling useSession().update()) — a
  // server-side redirect at this point gets bounced straight back to
  // /onboarding by middleware reading the stale token.
  return { status: "success", redirectTo: "/broker-accounts/new" };
}
