"use client";

import { useActionState, useState } from "react";
import { createBrokerAccountAction, type CreateBrokerAccountState } from "@/server/actions/broker-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const initialState: CreateBrokerAccountState = { status: "idle" };
const DEFAULT_BROKER_CODE = "ZERODHA";

export function NewBrokerAccountForm({
  brokers,
}: {
  brokers: { code: string; name: string; isImplemented: boolean }[];
}) {
  const [state, formAction, isPending] = useActionState(createBrokerAccountAction, initialState);
  const [brokerCode, setBrokerCode] = useState(DEFAULT_BROKER_CODE);
  const selectedBrokerName = brokers.find((b) => b.code === brokerCode)?.name ?? "Broker";

  return (
    <Card>
      <CardContent className="p-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brokerCode">Broker</Label>
            <select
              id="brokerCode"
              name="brokerCode"
              required
              value={brokerCode}
              onChange={(e) => setBrokerCode(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {brokers.map((broker) => (
                <option key={broker.code} value={broker.code} disabled={!broker.isImplemented}>
                  {broker.name}
                  {!broker.isImplemented ? " (coming soon)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Zerodha, Dhan, Upstox, Angel One and Kotak Securities are supported. Other brokers are visible but disabled.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Account nickname</Label>
            <Input id="nickname" name="nickname" placeholder={`e.g. ${selectedBrokerName} — Primary`} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startingCapital">Starting capital (₹, optional)</Label>
            <Input id="startingCapital" name="startingCapital" type="number" min={0} step="0.01" placeholder="500000" />
          </div>

          {state.status === "error" && state.message && (
            <p className="text-sm font-medium text-destructive">{state.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
