import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { kotakConnector } from "../kotak-connect";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.KOTAK_CONSUMER_KEY = "test_consumer_key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("kotakConnector.isConfigured", () => {
  it("is true when KOTAK_CONSUMER_KEY is set", () => {
    expect(kotakConnector.isConfigured()).toBe(true);
  });
  it("is false when missing", () => {
    delete process.env.KOTAK_CONSUMER_KEY;
    expect(kotakConnector.isConfigured()).toBe(false);
  });
});

describe("kotakConnector.login", () => {
  it("performs both totp_login then totp_validate in sequence, with the right headers each step", async () => {
    const calls: { url: string; headers: Record<string, string>; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        if (url.includes("tradeApiLogin")) {
          return { ok: true, json: async () => ({ data: { token: "view-token", sid: "view-sid", ucc: "UCC1" } }) };
        }
        return {
          ok: true,
          json: async () => ({
            data: { token: "edit-token", sid: "edit-sid", rid: "r1", dataCenter: "gdc", baseUrl: "https://custom.kotaksecurities.com", ucc: "UCC1" },
          }),
        };
      })
    );

    const result = await kotakConnector.login({ mobileNumber: "+919999999999", ucc: "UCC1", totp: "111111", mpin: "9999" });

    expect(calls).toHaveLength(2);
    // Step 1: totp_login — Authorization is the raw consumer key, no sid/Auth yet.
    expect(calls[0]!.url).toBe("https://mis.kotaksecurities.com/login/1.0/tradeApiLogin");
    expect(calls[0]!.headers.Authorization).toBe("test_consumer_key");
    expect(calls[0]!.body).toEqual({ mobileNumber: "+919999999999", ucc: "UCC1", totp: "111111" });

    // Step 2: totp_validate — carries the sid/token from step 1, plus the MPIN.
    expect(calls[1]!.url).toBe("https://mis.kotaksecurities.com/login/1.0/tradeApiValidate");
    expect(calls[1]!.headers.sid).toBe("view-sid");
    expect(calls[1]!.headers.Auth).toBe("view-token");
    expect(calls[1]!.body).toEqual({ mpin: "9999" });

    expect(result.accessToken).toBe("edit-token");
    expect(result.session?.sid).toBe("edit-sid");
    expect(result.session?.baseUrl).toBe("https://custom.kotaksecurities.com");
    // The MPIN itself must never appear anywhere in the returned token object.
    expect(JSON.stringify(result)).not.toContain("9999");
  });

  it("throws when any required credential is missing", async () => {
    await expect(kotakConnector.login({ mobileNumber: "+91999" })).rejects.toThrow(/required/i);
  });
});

describe("kotakConnector.fetchTodaysTrades", () => {
  it("uses the dynamic baseUrl + sid/Auth headers, splits exSeg, and parses the DD-Mon-YYYY date", async () => {
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
            data: [
              {
                trdSym: "IDEA-EQ",
                sym: "IDEA",
                trnsTp: "B",
                fldQty: 1,
                avgPrc: "9.39",
                exSeg: "nse_cm",
                flDt: "22-Jan-2025",
                flTm: "14:28:16",
                nOrdNo: "250122000612876",
                exOrdId: "1100000059569867",
                flId: "207983744",
              },
            ],
          }),
        };
      })
    );

    const trades = await kotakConnector.fetchTodaysTrades("edit-token", { sid: "edit-sid", baseUrl: "https://custom.kotaksecurities.com" });

    expect(capturedUrl).toBe("https://custom.kotaksecurities.com/quick/user/trades");
    expect(capturedHeaders.Sid).toBe("edit-sid");
    expect(capturedHeaders.Auth).toBe("edit-token");
    expect(trades[0]!.symbol).toBe("IDEA");
    expect(trades[0]!.exchange).toBe("NSE");
    expect(trades[0]!.segment).toBe("EQ");
    expect(trades[0]!.side).toBe("BUY");
    expect(trades[0]!.executedAt.toISOString()).toBe(new Date("2025-01-22T14:28:16+05:30").toISOString());
  });
});
