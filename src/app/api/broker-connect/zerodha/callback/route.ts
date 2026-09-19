import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/brokers/handle-oauth-callback";

/**
 * Zerodha redirects here after the user logs in on Kite's own site, with
 * `request_token` and `status=success` as query params (or `status`
 * absent/failure on a declined login). We never receive a password — only
 * this one-time token, which we exchange server-side for an access token
 * (see broker-connect.service.ts / kite-connect.ts).
 */
export async function GET(request: NextRequest) {
  return handleOAuthCallback(
    request,
    "Zerodha",
    "request_token",
    (params) => params.get("status") !== "success"
  );
}
