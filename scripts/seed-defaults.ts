import { closeDatabase } from "../src/db/client";
import { ensureBootstrapDefaults } from "../src/server/services/bootstrap";

async function main() {
  await ensureBootstrapDefaults();
  process.stdout.write("Default application settings are present.\n");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown seed error";
    process.stderr.write(`Seeding failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
