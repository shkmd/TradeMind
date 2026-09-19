"use client";

import { useActionState } from "react";
import { Link2, RefreshCw, ShieldAlert } from "lucide-react";
import {
  initiateBrokerConnectAction,
  syncBrokerAccountAction,
  directLoginConnectAction,
  type SyncAccountState,
  type DirectLoginState,
} from "@/server/actions/broker-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const syncInitialState: SyncAccountState = { status: "idle" };
const directLoginInitialState: DirectLoginState = { status: "idle" };

export function LiveConnectCard({
  brokerAccountId,
  brokerCode,
  connectorKind,
  isConfigured,
  connectionStatus,
  lastSyncedAt,
  connectError,
  justConnected,
}: {
  brokerAccountId: string;
  brokerCode: string;
  connectorKind: "redirect" | "direct";
  isConfigured: boolean;
  connectionStatus: string | null;
  lastSyncedAt: Date | null;
  connectError?: string;
  justConnected?: boolean;
}) {
  const isActive = connectionStatus === "ACTIVE";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-foreground">Live connection</CardTitle>
        {connectionStatus && (
          <Badge variant={isActive ? "success" : connectionStatus === "EXPIRED" ? "warning" : "secondary"}>
            {connectionStatus}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!isConfigured && (
          <p className="text-sm text-muted-foreground">
            Live connect isn&apos;t configured on this server yet — see .env.example for the developer
            credentials this broker requires. CSV/XLSX Tradebook import above works regardless.
          </p>
        )}

        {isConfigured && connectError && (
          <p className="rounded-md bg-danger-muted px-3 py-2 text-sm text-danger-foreground">{connectError}</p>
        )}
        {isConfigured && justConnected && (
          <p className="rounded-md bg-success-muted px-3 py-2 text-sm text-success-foreground">
            Connected. Click &quot;Sync now&quot; to pull today&apos;s trades and current holdings.
          </p>
        )}

        {isConfigured && !isActive && connectorKind === "redirect" && (
          <form action={initiateBrokerConnectAction.bind(null, brokerAccountId)}>
            <Button type="submit" variant="outline" size="sm">
              <Link2 className="mr-1.5 h-4 w-4" />
              Connect (live)
            </Button>
          </form>
        )}

        {isConfigured && !isActive && connectorKind === "direct" && (
          <DirectLoginForm brokerAccountId={brokerAccountId} brokerCode={brokerCode} />
        )}

        {isConfigured && isActive && (
          <SyncSection brokerAccountId={brokerAccountId} lastSyncedAt={lastSyncedAt} />
        )}
      </CardContent>
    </Card>
  );
}

function SyncSection({ brokerAccountId, lastSyncedAt }: { brokerAccountId: string; lastSyncedAt: Date | null }) {
  const [syncState, syncAction, isSyncing] = useActionState(syncBrokerAccountAction, syncInitialState);

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Last synced: {lastSyncedAt ? formatDateTime(lastSyncedAt) : "never"}. Pulls today&apos;s fills and
        current holdings only — for historical backfill, use CSV import above.
      </p>
      <form action={syncAction}>
        <input type="hidden" name="brokerAccountId" value={brokerAccountId} />
        <Button type="submit" size="sm" disabled={isSyncing}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
      </form>
      {syncState.status === "success" && (
        <p className="text-sm text-success">
          Synced {syncState.tradesImported} new execution{syncState.tradesImported === 1 ? "" : "s"} (
          {syncState.duplicateTrades} already known), {syncState.holdingsSynced} holdings updated,{" "}
          {syncState.tradesGenerated} trade{syncState.tradesGenerated === 1 ? "" : "s"} regenerated.
        </p>
      )}
      {syncState.status === "error" && <p className="text-sm font-medium text-destructive">{syncState.message}</p>}
    </>
  );
}

function DirectLoginForm({ brokerAccountId, brokerCode }: { brokerAccountId: string; brokerCode: string }) {
  const [state, formAction, isPending] = useActionState(directLoginConnectAction, directLoginInitialState);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md bg-warning-muted px-3 py-2 text-xs text-warning-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          {brokerCode === "ANGEL_ONE" ? "Angel One" : "Kotak Neo"} has no broker-hosted login page for its
          trading API — your {brokerCode === "ANGEL_ONE" ? "password and TOTP" : "TOTP and MPIN"} are sent
          directly to {brokerCode === "ANGEL_ONE" ? "Angel One's" : "Kotak's"} own servers to create a
          session, and are never stored here. Used once per connection, then discarded. Your API key is
          stored, but encrypted — never in plain text.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {brokerCode === "ANGEL_ONE" ? (
          <>
            Don&apos;t have an API key yet? Generate one free at{" "}
            <span className="font-medium text-foreground">smartapi.angelone.in</span> — it&apos;s personal to
            your own Angel One account, not shared across users.
          </>
        ) : (
          <>
            Don&apos;t have an API key yet? Generate one free in the Kotak Neo app — More → Trade API →
            Generate application — it&apos;s personal to your own Kotak account, not shared across users.
          </>
        )}
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="brokerAccountId" value={brokerAccountId} />

        {brokerCode === "ANGEL_ONE" && (
          <>
            <Field label="API Key" name="apiKey" />
            <Field label="Client code" name="clientCode" />
            <Field label="Password" name="password" type="password" />
            <Field label="TOTP (from authenticator app)" name="totp" />
          </>
        )}

        {brokerCode === "KOTAK" && (
          <>
            <Field label="API Key (consumer key)" name="apiKey" />
            <Field label="Mobile number" name="mobileNumber" placeholder="+919999999999" />
            <Field label="UCC (client code)" name="ucc" />
            <Field label="TOTP (from authenticator app)" name="totp" />
            <Field label="MPIN" name="mpin" type="password" />
          </>
        )}

        {state.status === "error" && <p className="text-sm font-medium text-destructive">{state.message}</p>}
        {state.status === "success" && (
          <p className="text-sm text-success">
            Connected and synced {state.tradesImported} execution{state.tradesImported === 1 ? "" : "s"}.
          </p>
        )}

        <Button type="submit" size="sm" disabled={isPending}>
          <Link2 className="mr-1.5 h-4 w-4" />
          {isPending ? "Connecting…" : "Connect & sync"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required className="h-8 text-sm" />
    </div>
  );
}
