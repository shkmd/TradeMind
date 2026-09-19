import { describe, it, expect, afterEach, vi } from "vitest";
import { angelOneConnector } from "../angel-connect";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("angelOneConnector.isConfigured", () => {
  it("is always true — the API key is per-user now, not a server env var", () => {
    expect(angelOneConnector.isConfigured()).toBe(true);
  });
});

describe("angelOneConnector.login", () => {
  it("submits clientcode/password/totp, sends the given apiKey as X-PrivateKey, and never stores the password", async () => {
    let capturedBody: Record<string, string> = {};
    let capturedHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { headers: Record<string, string>; body: string }) => {
        capturedBody = JSON.parse(init.body);
        capturedHeaders = init.headers;
        return {
          ok: true,
          json: async () => ({
            status: true,
            data: { jwtToken: "jwt-abc", refreshToken: "refresh-abc", feedToken: "feed-abc" },
          }),
        };
      })
    );

    const result = await angelOneConnector.login({
      clientCode: "A123",
      password: "secret-pw",
      totp: "654321",
      apiKey: "user_api_key",
    });

    expect(capturedBody).toEqual({ clientcode: "A123", password: "secret-pw", totp: "654321" });
    expect(capturedHeaders["X-PrivateKey"]).toBe("user_api_key");
    expect(capturedHeaders["X-UserType"]).toBe("USER");
    expect(capturedHeaders["X-SourceID"]).toBe("WEB");
    expect(result.accessToken).toBe("jwt-abc");
    expect(result.brokerUserId).toBe("A123");
    // The apiKey travels forward in `session` so later syncs can reuse it.
    expect(result.session?.apiKey).toBe("user_api_key");
    // The password itself must never appear anywhere in the returned token object.
    expect(JSON.stringify(result)).not.toContain("secret-pw");
  });

  it("throws when any required credential (including apiKey) is missing", async () => {
    await expect(angelOneConnector.login({ clientCode: "A123", apiKey: "k" })).rejects.toThrow(/required/i);
    await expect(
      angelOneConnector.login({ clientCode: "A123", password: "pw", totp: "111111" })
    ).rejects.toThrow(/required/i);
  });
});

describe("angelOneConnector.fetchTodaysTrades", () => {
  it("throws a clear error when the session is missing its apiKey", async () => {
    await expect(angelOneConnector.fetchTodaysTrades("jwt-abc", {})).rejects.toThrow(/api key/i);
    await expect(angelOneConnector.fetchTodaysTrades("jwt-abc")).rejects.toThrow(/api key/i);
  });

  it("strips the '-EQ' suffix and combines today's date with the time-only filltime", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: true,
          data: [
            {
              exchange: "NSE",
              tradingsymbol: "ITC-EQ",
              transactiontype: "BUY",
              fillprice: "175.00",
              fillsize: "1",
              orderid: "O1",
              fillid: "F1",
              filltime: "13:27:53",
            },
          ],
        }),
      }))
    );

    const trades = await angelOneConnector.fetchTodaysTrades("jwt-abc", { apiKey: "user_api_key" });
    expect(trades[0]!.symbol).toBe("ITC");
    expect(trades[0]!.executedAt.toISOString().slice(11, 19)).toBe("07:57:53"); // 13:27:53 IST -> 07:57:53 UTC
  });

  it("skips F&O/commodity fills (non-NSE/BSE exchange) rather than importing them mis-priced", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: true,
          data: [
            {
              exchange: "NSE",
              tradingsymbol: "ITC-EQ",
              transactiontype: "BUY",
              fillprice: "175.00",
              fillsize: "1",
              orderid: "O1",
              fillid: "F1",
              filltime: "13:27:53",
            },
            {
              exchange: "NFO",
              tradingsymbol: "NIFTY24DEC24000CE",
              transactiontype: "SELL",
              fillprice: "50.00",
              fillsize: "50",
              orderid: "O2",
              fillid: "F2",
              filltime: "13:28:00",
            },
            {
              exchange: "MCX",
              tradingsymbol: "CRUDEOIL24DECFUT",
              transactiontype: "BUY",
              fillprice: "6000.00",
              fillsize: "10",
              orderid: "O3",
              fillid: "F3",
              filltime: "13:29:00",
            },
          ],
        }),
      }))
    );

    const trades = await angelOneConnector.fetchTodaysTrades("jwt-abc", { apiKey: "user_api_key" });
    expect(trades).toHaveLength(1);
    expect(trades[0]!.symbol).toBe("ITC");
  });
});

describe("angelOneConnector.fetchHoldings", () => {
  it("throws a clear error when the session is missing its apiKey", async () => {
    await expect(angelOneConnector.fetchHoldings("jwt-abc", {})).rejects.toThrow(/api key/i);
  });
});
