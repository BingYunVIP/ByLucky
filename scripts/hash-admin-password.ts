import { hashAdminPassword } from "../src/server/auth/password";

function readHiddenLine(prompt: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("This command requires an interactive terminal.");
  }

  return new Promise<string>((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Canceled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  const password = await readHiddenLine("Administrator password: ");
  const confirmation = await readHiddenLine("Confirm password: ");

  if (password !== confirmation) throw new Error("Passwords do not match.");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  if (password.length > 1024) throw new Error("Password is too long.");

  const encodedHash = await hashAdminPassword(password);
  process.stdout.write(`\nADMIN_PASSWORD_HASH=${encodedHash}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unable to hash password.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
