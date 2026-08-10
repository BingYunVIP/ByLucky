import { randomBytes } from "node:crypto";

function secret() {
  return randomBytes(32).toString("base64url");
}

process.stdout.write(`SESSION_SECRET=${secret()}\n`);
process.stdout.write(`CODE_HMAC_SECRET=${secret()}\n`);
process.stdout.write(`CONFIG_ENCRYPTION_KEY=${secret()}\n`);
