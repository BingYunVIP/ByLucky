import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { adminSessions } from "@/db/schema";

export const ADMIN_SESSION_COOKIE = "bylucky_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type AdminSession = {
  id: string;
  expiresAt: Date;
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

export async function createAdminSession(input: {
  ipHash: Buffer;
  userAgent: string | null;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [session] = await getDb()
    .insert(adminSessions)
    .values({
      tokenHash: hashSessionToken(token),
      expiresAt,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    })
    .returning({ id: adminSessions.id, expiresAt: adminSessions.expiresAt });

  if (!session) throw new Error("Failed to create administrator session");
  return { ...session, token };
}

export async function findAdminSession(token: string): Promise<AdminSession | null> {
  const now = new Date();
  const [session] = await getDb()
    .select({
      id: adminSessions.id,
      expiresAt: adminSessions.expiresAt,
      lastSeenAt: adminSessions.lastSeenAt,
    })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hashSessionToken(token)),
        gt(adminSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) return null;

  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
    await getDb()
      .update(adminSessions)
      .set({ lastSeenAt: now })
      .where(eq(adminSessions.id, session.id));
  }

  return { id: session.id, expiresAt: session.expiresAt };
}

export async function getCurrentAdminSession() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return findAdminSession(token);
}

export async function revokeAdminSession(token: string) {
  await getDb()
    .delete(adminSessions)
    .where(eq(adminSessions.tokenHash, hashSessionToken(token)));
}

export function adminSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function expiredAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}
