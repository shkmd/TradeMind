"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/rbac";
import {
  initiateLiveConnect,
  directLoginAndConnect,
  syncLiveAccount,
  BrokerNotLiveCapableError,
  BrokerApiNotConfiguredError,
  PENDING_CONNECTION_COOKIE,
} from "@/server/services/broker-connect.service";

/**
 * Redirects the user to the broker's own login page (Zerodha, Dhan or
 * Upstox — any redirect-login broker via BrokerApiConnector). We never see
 * their credentials — each broker only ever hands us a one-time
 * token/code on its own redirect back to
 * /api/broker-connect/{broker}/callback. Since none of them forward
 * arbitrary state through that redirect, a short-lived cookie is what ties
 * the callback back to this BrokerConnection.
 */
export async function initiateBrokerConnectAction(brokerAccountId: string): Promise<void> {
  const session = await requireSession();

  let loginUrl: string;
  try {
    const result = await initiateLiveConnect(session.user.id, brokerAccountId);
    loginUrl = result.loginUrl;
    const cookieStore = await cookies();
    cookieStore.set(PENDING_CONNECTION_COOKIE, result.connectionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes — plenty for a login redirect round trip
      path: "/",
    });
  } catch (error) {
    if (error instanceof BrokerNotLiveCapableError || error instanceof BrokerApiNotConfiguredError) {
      redirect(`/broker-accounts/${brokerAccountId}?connectError=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(loginUrl);
}

export type SyncAccountState = {
  status: "idle" | "error" | "success";
  message?: string;
  tradesFetched?: number;
  tradesImported?: number;
  duplicateTrades?: number;
  holdingsSynced?: number;
  tradesGenerated?: number;
};

export async function syncBrokerAccountAction(
  _prevState: SyncAccountState,
  formData: FormData
): Promise<SyncAccountState> {
  const session = await requireSession();
  const brokerAccountId = formData.get("brokerAccountId");
  if (typeof brokerAccountId !== "string" || !brokerAccountId) {
    return { status: "error", message: "Missing broker account." };
  }

  try {
    const result = await syncLiveAccount(session.user.id, brokerAccountId);
    return { status: "success", ...result };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Sync failed." };
  }
}

export type DirectLoginState = {
  status: "idle" | "error" | "success";
  message?: string;
} & Partial<SyncAccountState>;

/**
 * Angel One / Kotak: the submitted password/TOTP/MPIN in `formData` is
 * used once, forwarded to the broker's own login API, and never persisted
 * — see the warning on BrokerDirectLoginConnector. Connects and runs the
 * first sync in one action, since there's no separate redirect step to
 * split them across.
 */
export async function directLoginConnectAction(
  _prevState: DirectLoginState,
  formData: FormData
): Promise<DirectLoginState> {
  const session = await requireSession();
  const brokerAccountId = formData.get("brokerAccountId");
  if (typeof brokerAccountId !== "string" || !brokerAccountId) {
    return { status: "error", message: "Missing broker account." };
  }

  const credentials: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "brokerAccountId" && typeof value === "string") credentials[key] = value;
  }

  try {
    await directLoginAndConnect(session.user.id, brokerAccountId, credentials);
    const result = await syncLiveAccount(session.user.id, brokerAccountId);
    return { status: "success", ...result };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Connection failed." };
  }
}
