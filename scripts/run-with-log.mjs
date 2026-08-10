import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const separatorIndex = process.argv.indexOf("--");
const [scope, logName] = process.argv.slice(2, separatorIndex);
const [command, ...args] = process.argv.slice(separatorIndex + 1);

if (
  separatorIndex < 4 ||
  !scope ||
  !logName ||
  !command ||
  !/^[a-z0-9-]+$/i.test(scope) ||
  !/^[a-z0-9-]+$/i.test(logName)
) {
  throw new Error("Usage: run-with-log.mjs <scope> <name> -- <command> [arguments...]");
}

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logsRoot = resolve(projectDir, "logs");
const logDir = resolve(logsRoot, scope);

if (!logDir.startsWith(`${logsRoot}${sep}`)) {
  throw new Error("Log destination must remain inside the project logs directory.");
}

mkdirSync(logDir, { recursive: true });

const startedAt = new Date().toISOString();
const stdoutLog = createWriteStream(join(logDir, `${logName}.stdout.log`), { flags: "a" });
const stderrLog = createWriteStream(join(logDir, `${logName}.stderr.log`), { flags: "a" });
const header = `\n[${startedAt}] ${[command, ...args].join(" ")}\n`;
stdoutLog.write(header);
stderrLog.write(header);

const child = spawn(command, args, {
  cwd: projectDir,
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.pipe(process.stdout);
child.stdout.pipe(stdoutLog);
child.stderr.pipe(process.stderr);
child.stderr.pipe(stderrLog);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!stopping) {
      stopping = true;
      child.kill(signal);
    }
  });
}

child.once("error", (error) => {
  process.stderr.write(`Unable to start ${command}: ${error.message}\n`);
  stdoutLog.end();
  stderrLog.end();
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  const footer = `[${new Date().toISOString()}] exited${signal ? ` with ${signal}` : ` with code ${code ?? 1}`}\n`;
  stdoutLog.end(footer);
  stderrLog.end(footer);
  process.exitCode = code ?? 1;
});
