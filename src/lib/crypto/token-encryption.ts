import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for broker API tokens at rest. Never store an
 * access/refresh token in plaintext (see BrokerConnection.accessTokenEncrypted).
 * ENCRYPTION_KEY must be a 32-byte value, hex-encoded (64 hex chars) — see
 * .env.example for how to generate one.
 */
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes) — see .env.example."
    );
  }
  return Buffer.from(hex, "hex");
}

/** Returns `iv:authTag:ciphertext`, each hex-encoded and colon-separated. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(stored: string): string {
  const [ivHex, authTagHex, cipherHex] = stored.split(":");
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Malformed encrypted token payload.");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
