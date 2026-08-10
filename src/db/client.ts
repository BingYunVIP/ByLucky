import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/server/env";
import * as schema from "./schema";

type SqlClient = ReturnType<typeof postgres>;
type Database = PostgresJsDatabase<typeof schema>;

const globalDatabase = globalThis as typeof globalThis & {
  byluckySqlClient?: SqlClient;
  byluckyDatabase?: Database;
};

export function getSqlClient(): SqlClient {
  if (!globalDatabase.byluckySqlClient) {
    globalDatabase.byluckySqlClient = postgres(getServerEnv().DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return globalDatabase.byluckySqlClient;
}

export function getDb(): Database {
  if (!globalDatabase.byluckyDatabase) {
    globalDatabase.byluckyDatabase = drizzle(getSqlClient(), { schema });
  }

  return globalDatabase.byluckyDatabase;
}

export async function closeDatabase() {
  if (globalDatabase.byluckySqlClient) {
    await globalDatabase.byluckySqlClient.end({ timeout: 5 });
    globalDatabase.byluckySqlClient = undefined;
    globalDatabase.byluckyDatabase = undefined;
  }
}
