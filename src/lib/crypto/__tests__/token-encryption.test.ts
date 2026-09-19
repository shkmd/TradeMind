import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "../token-encryption";

beforeAll(() => {
  // 32 bytes, hex-encoded, for the test process only.
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("token encryption", () => {
  it("round-trips a plaintext token", () => {
    const plaintext = "kite-access-token-abc123XYZ";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptToken("same-token");
    const b = encryptToken("same-token");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-token");
    expect(decryptToken(b)).toBe("same-token");
  });

  it("throws on a tampered payload rather than silently returning garbage", () => {
    const encrypted = encryptToken("secret-value");
    const tampered = encrypted.slice(0, -2) + "00";
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws clearly when ENCRYPTION_KEY is missing or the wrong length", () => {
    const original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "too-short";
    expect(() => encryptToken("x")).toThrow(/64-character hex/);
    process.env.ENCRYPTION_KEY = original;
  });
});
