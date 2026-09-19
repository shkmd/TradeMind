import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dhanConnector } from "../dhan-connect";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.DHAN_APP_ID = "test_app_id";
  process.env.DHAN_APP_SECRET = "test_app_secret";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("dhanConnector.isConfigured", () => {
  it("is true when both DHAN_APP_ID and DHAN_APP_SECRET are set", () => {
    expect(dhanConnector.isConfigured()).toBe(true);
  });
  it("is false when either is missing", () => {
    delete process.env.DHAN_APP_SECRET;
    expect(dhanConnector.isConfigured()).toBe(false);
  });
});

describe("dhanConnector.buildLoginUrl", () => {
  it("generates consent (with app_id/app_secret headers) then builds the consentApp-login URL", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
        capturedUrl = url;
        capturedHeaders = init.headers;
        return { ok: true, json: async () => ({ consentAppId: "consent-abc-123" }) };
      })
    );

    const url = await dhanConnector.buildLoginUrl("connection-id");

    expect(capturedUrl).toBe("https://auth.dhan.co/app/generate-consent");
    expect(capturedHeaders.app_id).toBe("test_app_id");
    expect(capturedHeaders.app_secret).toBe("test_app_secret");
    expect(url).toBe("https://auth.dhan.co/login/consentApp-login?consentAppId=consent-abc-123");
  });
});

describe("dhanConnector.exchangeRequestToken", () => {
  it("posts tokenId as a query param to consumeApp-consent", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            accessToken: "the-access-token",
            dhanClientId: "1100000059",
            expiryTime: "2024-01-16T00:30:00.000Z",
          }),
        };
      })
    );

    const result = await dhanConnector.exchangeRequestToken("the-token-id");
    expect(capturedUrl).toBe("https://auth.dhan.co/app/consumeApp-consent?tokenId=the-token-id");
    expect(result.accessToken).toBe("the-access-token");
    expect(result.brokerUserId).toBe("1100000059");
  });
});

describe("dhanConnector.fetchTodaysTrades", () => {
  it("sends the access-token header and splits exchangeSegment into exchange + segment", async () => {
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
        capturedHeaders = init.headers;
        return {
          ok: true,
          json: async () => [
            {
              orderId: "O1",
              exchangeTradeId: "T1",
              transactionType: "BUY",
              exchangeSegment: "NSE_EQ",
              tradingSymbol: "RELIANCE",
              tradedQuantity: 50,
              tradedPrice: 2450,
              isin: "INE002A01018",
              exchangeTime: "2024-01-15T09:20:05",
            },
          ],
        };
      })
    );

    const trades = await dhanConnector.fetchTodaysTrades("the-access-token");
    expect(capturedHeaders["access-token"]).toBe("the-access-token");
    expect(trades[0]!.exchange).toBe("NSE");
    expect(trades[0]!.segment).toBe("EQ");
    expect(trades[0]!.side).toBe("BUY");
  });
});
