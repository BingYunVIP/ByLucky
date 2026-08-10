import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDatabase, getDb } from "../src/db/client";
import { ensureBootstrapDefaults } from "../src/server/services/bootstrap";

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  await ensureBootstrapDefaults();
  process.stdout.write("Database migrations and default settings are up to date.\n");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown migration error";
    process.stderr.write(`Migration failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
