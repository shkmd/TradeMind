import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/brokers/handle-oauth-callback";

/**
 * Dhan redirects here after the user logs in on Dhan's own site, with
 * `tokenId` as the only query param (no explicit status flag — its
 * absence is itself the failure signal). We never receive a password —
 * only this one-time token, exchanged server-side for an access token
 * (see broker-connect.service.ts / dhan-connect.ts).
 */
export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, "Dhan", "tokenId", (params) => !params.get("tokenId"));
}
