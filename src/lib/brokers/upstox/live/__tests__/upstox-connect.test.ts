import { describe, it, expect, afterEach, vi } from "vitest";
import { upstoxConnector } from "../upstox-connect";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upstoxConnector.isConfigured", () => {
  it("is always true — the access token is per-user now, not a server env var", () => {
    expect(upstoxConnector.isConfigured()).toBe(true);
  });
});

describe("upstoxConnector.login", () => {
  it("accepts a self-generated access token without any API call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await upstoxConnector.login({ accessToken: "user-generated-token" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.accessToken).toBe("user-generated-token");
  });

  it("throws when the access token is missing", async () => {
    await expect(upstoxConnector.login({})).rejects.toThrow(/required/i);
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

describe("upstoxConnector.fetchHoldings", () => {
  it("sends a Bearer auth header and maps holdings", async () => {
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
            { isin: "INE062A01020", quantity: 5, tradingsymbol: "SBIN", average_price: 500, last_price: 520, exchange: "NSE" },
          ],
        };
      })
    );

    const holdings = await upstoxConnector.fetchHoldings("the-access-token");
    expect(capturedHeaders.Authorization).toBe("Bearer the-access-token");
    expect(capturedUrl).toContain("/v2/portfolio/long-term-holdings");
    expect(holdings[0]!.symbol).toBe("SBIN");
    expect(holdings[0]!.avgCostPrice).toBe(500);
  });
});
