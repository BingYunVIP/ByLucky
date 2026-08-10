import "dotenv/config";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  ADMIN_USERNAME: z.string().min(1).max(128),
  ADMIN_PASSWORD_HASH: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CODE_HMAC_SECRET: z.string().min(32),
  CONFIG_ENCRYPTION_KEY: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = Object.keys(result.error.flatten().fieldErrors).join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetServerEnvForTests() {
  cachedEnv = undefined;
}
