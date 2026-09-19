"use client";

import { useActionState } from "react";
import { updateProfileAction, changePasswordAction, type SettingsActionState } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const initial: SettingsActionState = { status: "idle" };

export function ProfileForm({
  displayName,
  startingCapital,
  maxRiskPerTradePct,
  maxDailyLossAmount,
  maxTradesPerDay,
}: {
  displayName: string;
  startingCapital: number | null;
  maxRiskPerTradePct: number | null;
  maxDailyLossAmount: number | null;
  maxTradesPerDay: number | null;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile & risk limits</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" name="displayName" defaultValue={displayName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startingCapital">Starting capital (₹)</Label>
            <Input id="startingCapital" name="startingCapital" type="number" step="0.01" defaultValue={startingCapital ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxRiskPerTradePct">Max risk per trade (%)</Label>
            <Input id="maxRiskPerTradePct" name="maxRiskPerTradePct" type="number" step="0.1" defaultValue={maxRiskPerTradePct ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxDailyLossAmount">Max daily loss (₹)</Label>
            <Input id="maxDailyLossAmount" name="maxDailyLossAmount" type="number" step="0.01" defaultValue={maxDailyLossAmount ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTradesPerDay">Max trades per day</Label>
            <Input id="maxTradesPerDay" name="maxTradesPerDay" type="number" defaultValue={maxTradesPerDay ?? ""} />
          </div>
          <div className="sm:col-span-2">
            {state.status !== "idle" && (
              <p className={`text-sm font-medium ${state.status === "error" ? "text-destructive" : "text-success"}`}>
                {state.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SecurityForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required />
          </div>
          <div className="sm:col-span-2">
            {state.status !== "idle" && (
              <p className={`text-sm font-medium ${state.status === "error" ? "text-destructive" : "text-success"}`}>
                {state.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating…" : "Change password"}
            </Button>
          </div>
        </form>

        <div className="flex items-center justify-between rounded-md border border-surface-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Two-factor authentication</p>
            <p className="text-xs text-muted-foreground">TOTP-based 2FA setup is coming in a later release.</p>
          </div>
          <Switch disabled />
        </div>
      </CardContent>
    </Card>
  );
}
