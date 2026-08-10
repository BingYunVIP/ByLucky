import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_VERSION = "v1";
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashAdminPassword(password: string) {
  const salt = randomBytes(16);
  const digest = await deriveKey(password, salt);
  return [
    "scrypt",
    SCRYPT_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join(":");
}

export async function verifyAdminPassword(password: string, encodedHash: string) {
  try {
    const [algorithm, version, n, r, p, encodedSalt, encodedDigest, extra] =
      encodedHash.split(":");

    if (
      algorithm !== "scrypt" ||
      version !== SCRYPT_VERSION ||
      Number(n) !== SCRYPT_N ||
      Number(r) !== SCRYPT_R ||
      Number(p) !== SCRYPT_P ||
      !encodedSalt ||
      !encodedDigest ||
      extra !== undefined
    ) {
      return false;
    }

    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedDigest = Buffer.from(encodedDigest, "base64url");
    if (salt.length !== 16 || expectedDigest.length !== SCRYPT_KEY_LENGTH) {
      return false;
    }

    const actualDigest = await deriveKey(password, salt);
    return timingSafeEqual(actualDigest, expectedDigest);
  } catch {
    return false;
  }
}

export function timingSafeTextEqual(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
