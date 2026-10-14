import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedValue = { value: string; nonce: string; authTag: string };

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown, secret: string): EncryptedValue {
  if (!secret) throw new Error("APP_CONFIG_ENCRYPTION_KEY is required for sensitive settings");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    value: encrypted.toString("base64url"),
    nonce: nonce.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptJson<T>(encrypted: EncryptedValue, secret: string): T {
  if (!secret) throw new Error("APP_CONFIG_ENCRYPTION_KEY is required for sensitive settings");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromSecret(secret),
    Buffer.from(encrypted.nonce, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64url"));
  const value = Buffer.concat([
    decipher.update(Buffer.from(encrypted.value, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(value) as T;
}
