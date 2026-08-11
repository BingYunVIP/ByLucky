import { readFileSync } from "node:fs";

import { hashAdminPassword } from "../src/server/auth/password";

async function main() {
  const password = readFileSync(0, "utf8");

  if (password.length === 0) {
    throw new Error("Administrator password cannot be empty.");
  }

  process.stdout.write(await hashAdminPassword(password));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unable to hash the administrator password.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
