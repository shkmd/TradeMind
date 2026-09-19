import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { angelOneConnector } from "../angel-connect";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.ANGEL_ONE_API_KEY = "test_api_key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("angelOneConnector.isConfigured", () => {
  it("is true when ANGEL_ONE_API_KEY is set", () => {
    expect(angelOneConnector.isConfigured()).toBe(true);
  });
  it("is false when missing", () => {
    delete process.env.ANGEL_ONE_API_KEY;
    expect(angelOneConnector.isConfigured()).toBe(false);
  });
});

describe("angelOneConnector.login", () => {
  it("submits clientcode/password/totp and sends the required X-* headers, never storing the password", async () => {
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

    const result = await angelOneConnector.login({ clientCode: "A123", password: "secret-pw", totp: "654321" });

    expect(capturedBody).toEqual({ clientcode: "A123", password: "secret-pw", totp: "654321" });
    expect(capturedHeaders["X-PrivateKey"]).toBe("test_api_key");
    expect(capturedHeaders["X-UserType"]).toBe("USER");
    expect(capturedHeaders["X-SourceID"]).toBe("WEB");
    expect(result.accessToken).toBe("jwt-abc");
    expect(result.brokerUserId).toBe("A123");
    // The password itself must never appear anywhere in the returned token object.
    expect(JSON.stringify(result)).not.toContain("secret-pw");
  });

  it("throws when any required credential is missing", async () => {
    await expect(angelOneConnector.login({ clientCode: "A123" })).rejects.toThrow(/required/i);
  });
});

describe("angelOneConnector.fetchTodaysTrades", () => {
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

    const trades = await angelOneConnector.fetchTodaysTrades("jwt-abc");
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

    const trades = await angelOneConnector.fetchTodaysTrades("jwt-abc");
    expect(trades).toHaveLength(1);
    expect(trades[0]!.symbol).toBe("ITC");
  });
});
