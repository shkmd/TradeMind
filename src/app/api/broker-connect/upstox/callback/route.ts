import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/brokers/handle-oauth-callback";

/**
 * Upstox redirects here after the user logs in on Upstox's own site, with
 * standard OAuth2 `code` (success) or `error` (failure) query params. We
 * never receive a password — only this one-time code, exchanged
 * server-side for an access token (see broker-connect.service.ts /
 * upstox-connect.ts).
 */
export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, "Upstox", "code", (params) => Boolean(params.get("error")));
}
