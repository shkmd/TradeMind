import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { upstoxConnector } from "../upstox-connect";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.UPSTOX_CLIENT_ID = "test_client_id";
  process.env.UPSTOX_CLIENT_SECRET = "test_client_secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("upstoxConnector.isConfigured", () => {
  it("is true when both client id/secret are set", () => {
    expect(upstoxConnector.isConfigured()).toBe(true);
  });
  it("is false when either is missing", () => {
    delete process.env.UPSTOX_CLIENT_SECRET;
    expect(upstoxConnector.isConfigured()).toBe(false);
  });
});

describe("upstoxConnector.buildLoginUrl", () => {
  it("builds the standard OAuth2 authorize URL with response_type=code", async () => {
    const url = await upstoxConnector.buildLoginUrl("connection-id");
    expect(url).toBe(
      "https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=test_client_id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fbroker-connect%2Fupstox%2Fcallback"
    );
  });
});

describe("upstoxConnector.exchangeRequestToken", () => {
  it("posts the authorization_code grant with form-encoded body", async () => {
    let capturedBody = "";
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { headers: Record<string, string>; body: string }) => {
        capturedBody = init.body;
        capturedHeaders = init.headers;
        return { ok: true, json: async () => ({ status: "success", data: { access_token: "tok", user_id: "U1" } }) };
      })
    );

    const result = await upstoxConnector.exchangeRequestToken("auth-code-123");
    const params = new URLSearchParams(capturedBody);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("auth-code-123");
    expect(params.get("client_id")).toBe("test_client_id");
    expect(params.get("client_secret")).toBe("test_client_secret");
    expect(capturedHeaders["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(result.accessToken).toBe("tok");
    expect(result.brokerUserId).toBe("U1");
  });
});

describe("upstoxConnector.fetchTodaysTrades", () => {
  it("sends a Bearer auth header and requests today's date range", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
        capturedUrl = url;
        capturedHeaders = init.headers;
        return {
          ok: true,
          json: async () => ({
            status: "success",
            data: {
              trades: [
                {
                  exchange: "NSE",
                  segment: "EQ",
                  quantity: 10,
                  trade_id: "T1",
                  trade_date: "2024-01-15",
                  transaction_type: "BUY",
                  price: 100,
                  symbol: "SBIN",
                },
              ],
            },
          }),
        };
      })
    );

    const trades = await upstoxConnector.fetchTodaysTrades("the-access-token");
    expect(capturedHeaders.Authorization).toBe("Bearer the-access-token");
    expect(capturedUrl).toContain("/v2/charges/historical-trades?");
    expect(trades[0]!.brokerOrderId).toBe("T1"); // falls back to trade_id
  });
});
