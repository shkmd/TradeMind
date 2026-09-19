import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "crypto";
import { kiteConnectConnector } from "../kite-connect";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.KITE_API_KEY = "test_api_key";
  process.env.KITE_API_SECRET = "test_api_secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("kiteConnectConnector.isConfigured", () => {
  it("is true when both KITE_API_KEY and KITE_API_SECRET are set", () => {
    expect(kiteConnectConnector.isConfigured()).toBe(true);
  });

  it("is false when either is missing", () => {
    delete process.env.KITE_API_SECRET;
    expect(kiteConnectConnector.isConfigured()).toBe(false);
  });
});

describe("kiteConnectConnector.buildLoginUrl", () => {
  it("points at Kite's own login page with the api_key and v=3", async () => {
    const url = await kiteConnectConnector.buildLoginUrl("connection-id-123");
    expect(url).toBe("https://kite.zerodha.com/connect/login?api_key=test_api_key&v=3");
  });

  it("rejects when KITE_API_KEY is missing", async () => {
    delete process.env.KITE_API_KEY;
    await expect(kiteConnectConnector.buildLoginUrl("x")).rejects.toThrow(/KITE_API_KEY/);
  });
});

describe("kiteConnectConnector.exchangeRequestToken", () => {
  it("posts the correct checksum (sha256 of api_key+request_token+api_secret) to /session/token", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
        capturedUrl = url;
        capturedBody = init.body;
        capturedHeaders = init.headers;
        return {
          ok: true,
          json: async () => ({
            status: "success",
            data: { access_token: "the-access-token", user_id: "AB1234", user_name: "Test User" },
          }),
        };
      })
    );

    const result = await kiteConnectConnector.exchangeRequestToken("the-request-token");

    expect(capturedUrl).toBe("https://api.kite.trade/session/token");
    expect(capturedHeaders["X-Kite-Version"]).toBe("3");
    expect(capturedHeaders["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const params = new URLSearchParams(capturedBody);
    const expectedChecksum = createHash("sha256")
      .update("test_api_key" + "the-request-token" + "test_api_secret")
      .digest("hex");
    expect(params.get("checksum")).toBe(expectedChecksum);
    expect(params.get("api_key")).toBe("test_api_key");
    expect(params.get("request_token")).toBe("the-request-token");

    expect(result.accessToken).toBe("the-access-token");
    expect(result.brokerUserId).toBe("AB1234");
    // Access token must expire in the future.
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("throws a descriptive error when Kite returns an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ status: "error", error_type: "TokenException", message: "Invalid checksum" }),
      }))
    );

    await expect(kiteConnectConnector.exchangeRequestToken("bad-token")).rejects.toThrow(/Invalid checksum/);
  });
});
