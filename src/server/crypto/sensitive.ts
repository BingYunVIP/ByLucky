import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { getServerEnv } from "@/server/env";

const ENCRYPTION_VERSION = "v1";

function getEncryptionKey() {
  const suppliedKey = Buffer.from(getServerEnv().CONFIG_ENCRYPTION_KEY, "base64url");
  if (suppliedKey.length === 32) return suppliedKey;

  // Keep existing Phase 1 environments usable while deriving a stable AES-256 key.
  return createHash("sha256")
    .update(getServerEnv().CONFIG_ENCRYPTION_KEY, "utf8")
    .digest();
}

export function hashExactCode(value: string, secret = getServerEnv().CODE_HMAC_SECRET) {
  return createHmac("sha256", secret).update(value, "utf8").digest();
}

export function codeHashKey(value: Buffer) {
  return value.toString("hex");
}

export function encryptSensitiveText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(":");
}

export function decryptSensitiveText(payload: string) {
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = payload.split(":");
  if (
    version !== ENCRYPTION_VERSION ||
    !encodedIv ||
    !encodedCiphertext ||
    !encodedTag ||
    extra !== undefined
  ) {
    throw new Error("Invalid encrypted payload");
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
