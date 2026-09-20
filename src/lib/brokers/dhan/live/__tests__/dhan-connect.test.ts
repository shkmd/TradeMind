import { describe, it, expect, afterEach, vi } from "vitest";
import { dhanConnector } from "../dhan-connect";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dhanConnector.isConfigured", () => {
  it("is always true — the access token is per-user now, not a server env var", () => {
    expect(dhanConnector.isConfigured()).toBe(true);
  });
});

describe("dhanConnector.login", () => {
  it("accepts a self-generated access token + Dhan Client ID without any API call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await dhanConnector.login({ accessToken: "user-generated-token", dhanClientId: "1100000059" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.accessToken).toBe("user-generated-token");
    expect(result.brokerUserId).toBe("1100000059");
    expect(result.session?.dhanClientId).toBe("1100000059");
  });

  it("throws when either credential is missing", async () => {
    await expect(dhanConnector.login({ accessToken: "t" })).rejects.toThrow(/required/i);
    await expect(dhanConnector.login({ dhanClientId: "1100000059" })).rejects.toThrow(/required/i);
  });
});

describe("dhanConnector.fetchTodaysTrades", () => {
  it("calls the v2 endpoint, sends the access-token header, and splits exchangeSegment into exchange + segment", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
        capturedUrl = url;
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
    expect(capturedUrl).toBe("https://api.dhan.co/v2/trades");
    expect(capturedHeaders["access-token"]).toBe("the-access-token");
    expect(trades[0]!.exchange).toBe("NSE");
    expect(trades[0]!.segment).toBe("EQ");
    expect(trades[0]!.side).toBe("BUY");
  });
});

describe("dhanConnector.fetchHoldings", () => {
  it("calls the v2 endpoint and sends the access-token header", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
        capturedUrl = url;
        capturedHeaders = init.headers;
        return {
          ok: true,
          json: async () => [
            { tradingSymbol: "WIPRO", exchange: "NSE", totalQty: 10, avgCostPrice: 400, lastTradedPrice: 420, isin: "INE075A01022" },
          ],
        };
      })
    );

    const holdings = await dhanConnector.fetchHoldings("the-access-token");
    expect(capturedUrl).toBe("https://api.dhan.co/v2/holdings");
    expect(capturedHeaders["access-token"]).toBe("the-access-token");
    expect(holdings[0]!.symbol).toBe("WIPRO");
    expect(holdings[0]!.avgCostPrice).toBe(400);
  });
});
