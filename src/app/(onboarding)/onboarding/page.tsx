"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onboardingAction, type OnboardingActionState } from "@/server/actions/onboarding";
import { refreshSessionToken } from "@/lib/auth/refresh-session-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
const initialState: OnboardingActionState = { status: "idle" };

export default function OnboardingPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(onboardingAction, initialState);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (state.status !== "success" || !state.redirectTo) return;
    setIsRedirecting(true);
    // The server action already marked onboarding complete in the DB, but
    // middleware reads the JWT, not the DB — without refreshing the token
    // first, it would bounce this navigation straight back to /onboarding.
    refreshSessionToken().then(() => {
      router.push(state.redirectTo!);
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.redirectTo]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-normal text-foreground">
          Set up your journal
        </CardTitle>
        <CardDescription>
          A few details about how you trade, so your journal can grade trades against your own
          rules. You can change every value later in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" name="displayName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" defaultValue="Asia/Kolkata" readOnly />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fyStartMonth">Financial year start</Label>
              <input type="hidden" name="fyStartMonth" value="4" />
              <Input id="fyStartMonth" value="April (Indian FY)" readOnly />
            </div>
            <div className="space-y-2">
              <Label>Experience level</Label>
              <SelectNativeMirror name="experienceLevel" defaultValue="INTERMEDIATE" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Trader profile</Label>
            <SelectNativeMirror
              name="traderProfileType"
              defaultValue="SWING"
              options={[
                ["INVESTOR", "Investor"],
                ["SWING", "Swing / positional"],
                ["INTRADAY", "Intraday"],
                ["OPTIONS", "Options trader"],
                ["ALGO", "Algo trader"],
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startingCapital">Starting capital (₹)</Label>
              <Input id="startingCapital" name="startingCapital" type="number" min={0} step="0.01" defaultValue={500000} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRiskPerTradePct">Max risk per trade (%)</Label>
              <Input id="maxRiskPerTradePct" name="maxRiskPerTradePct" type="number" min={0} max={100} step="0.1" defaultValue={2} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDailyLossAmount">Max daily loss (₹)</Label>
              <Input id="maxDailyLossAmount" name="maxDailyLossAmount" type="number" min={0} step="0.01" defaultValue={10000} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTradesPerDay">Max trades per day</Label>
              <Input id="maxTradesPerDay" name="maxTradesPerDay" type="number" min={1} defaultValue={5} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="minRiskRewardRatio">Minimum acceptable risk-reward ratio</Label>
              <Input id="minRiskRewardRatio" name="minRiskRewardRatio" type="number" min={0} step="0.1" defaultValue={1.5} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Get started with</Label>
            <SelectNativeMirror
              name="dataChoice"
              defaultValue="DEMO"
              options={[
                ["DEMO", "Load realistic demo data (recommended for a first look)"],
                ["OWN_IMPORT", "I'll connect a broker account and import my own trades"],
              ]}
            />
          </div>

          {state.status === "error" && state.message && (
            <p className="text-sm font-medium text-destructive">{state.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending || isRedirecting}>
            {isPending ? "Setting up…" : isRedirecting ? "Almost there…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * The shadcn Select is Radix-based and doesn't submit a native form value on
 * its own. Rather than wiring per-field controlled state, this renders a
 * plain <select> styled to match — simplest correct option for a
 * server-action form with no client-side validation step.
 */
function SelectNativeMirror({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options?: [string, string][];
}) {
  const opts =
    options ?? [
      ["BEGINNER", "Beginner"],
      ["INTERMEDIATE", "Intermediate"],
      ["EXPERIENCED", "Experienced"],
      ["PROFESSIONAL", "Professional"],
    ];
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {opts.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
