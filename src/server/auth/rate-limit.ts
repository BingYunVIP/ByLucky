import { createHmac } from "node:crypto";
import { getSqlClient } from "@/db/client";
import { getServerEnv } from "@/server/env";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const PARTICIPATION_WINDOW_MS = 5 * 60 * 1000;
const PARTICIPATION_BLOCK_MS = 10 * 60 * 1000;
const PARTICIPATION_MAX_FAILURES = 12;

type RateLimitRow = {
  window_started_at: Date | string;
  counter: number;
  blocked_until: Date | string | null;
};

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function createLoginBucketKey(ipAddress: string) {
  return createHmac("sha256", getServerEnv().SESSION_SECRET)
    .update("rate-limit:login:", "utf8")
    .update(ipAddress, "utf8")
    .digest("hex");
}

export async function checkLoginRateLimit(bucketKey: string) {
  const rows = await getSqlClient()<RateLimitRow[]>`
    select window_started_at, counter, blocked_until
    from security_rate_limits
    where bucket_key = ${bucketKey} and scope = 'LOGIN'
    limit 1
  `;
  const blockedUntil = rows[0]?.blocked_until
    ? asDate(rows[0].blocked_until)
    : null;
  const now = Date.now();

  if (blockedUntil && blockedUntil.getTime() > now) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now) / 1000)),
    };
  }

  return { allowed: true as const, retryAfterSeconds: 0 };
}

export async function recordLoginFailure(bucketKey: string) {
  const client = getSqlClient();
  const now = new Date();

  return client.begin(async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(hashtextextended(${bucketKey}, 0))
    `;

    const rows = await transaction<RateLimitRow[]>`
      select window_started_at, counter, blocked_until
      from security_rate_limits
      where bucket_key = ${bucketKey}
      for update
    `;
    const current = rows[0];
    const currentWindowStartedAt = current
      ? asDate(current.window_started_at)
      : null;
    const windowExpired =
      !current || now.getTime() - currentWindowStartedAt!.getTime() >= LOGIN_WINDOW_MS;
    const counter = windowExpired ? 1 : current.counter + 1;
    const blockedUntil =
      counter >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null;
    const windowStartedAt = windowExpired ? now : currentWindowStartedAt!;

    await transaction`
      insert into security_rate_limits (
        bucket_key,
        scope,
        window_started_at,
        counter,
        blocked_until,
        updated_at
      ) values (
        ${bucketKey},
        'LOGIN',
        ${windowStartedAt.toISOString()}::timestamptz,
        ${counter},
        ${blockedUntil?.toISOString() ?? null}::timestamptz,
        ${now.toISOString()}::timestamptz
      )
      on conflict (bucket_key) do update set
        scope = excluded.scope,
        window_started_at = excluded.window_started_at,
        counter = excluded.counter,
        blocked_until = excluded.blocked_until,
        updated_at = excluded.updated_at
    `;

    return {
      blocked: blockedUntil !== null,
      retryAfterSeconds: blockedUntil ? LOGIN_BLOCK_MS / 1000 : 0,
    };
  });
}

export async function clearLoginRateLimit(bucketKey: string) {
  await getSqlClient()`
    delete from security_rate_limits
    where bucket_key = ${bucketKey} and scope = 'LOGIN'
  `;
}

export function createParticipationBucketKey(ipAddress: string) {
  return createHmac("sha256", getServerEnv().SESSION_SECRET)
    .update("rate-limit:participation:", "utf8")
    .update(ipAddress, "utf8")
    .digest("hex");
}

export async function checkParticipationRateLimit(bucketKey: string) {
  const rows = await getSqlClient()<RateLimitRow[]>`
    select window_started_at, counter, blocked_until
    from security_rate_limits
    where bucket_key = ${bucketKey} and scope = 'PARTICIPATION'
    limit 1
  `;
  const blockedUntil = rows[0]?.blocked_until
    ? asDate(rows[0].blocked_until)
    : null;
  const now = Date.now();
  if (blockedUntil && blockedUntil.getTime() > now) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now) / 1000)),
    };
  }
  return { allowed: true as const, retryAfterSeconds: 0 };
}

export async function recordParticipationFailure(bucketKey: string) {
  const client = getSqlClient();
  const now = new Date();
  return client.begin(async (transaction) => {
    await transaction`
      select pg_advisory_xact_lock(hashtextextended(${bucketKey}, 0))
    `;
    const rows = await transaction<RateLimitRow[]>`
      select window_started_at, counter, blocked_until
      from security_rate_limits
      where bucket_key = ${bucketKey}
      for update
    `;
    const current = rows[0];
    const currentWindowStartedAt = current ? asDate(current.window_started_at) : null;
    const windowExpired =
      !current || now.getTime() - currentWindowStartedAt!.getTime() >= PARTICIPATION_WINDOW_MS;
    const counter = windowExpired ? 1 : current.counter + 1;
    const blockedUntil =
      counter >= PARTICIPATION_MAX_FAILURES
        ? new Date(now.getTime() + PARTICIPATION_BLOCK_MS)
        : null;
    const windowStartedAt = windowExpired ? now : currentWindowStartedAt!;

    await transaction`
      insert into security_rate_limits (
        bucket_key, scope, window_started_at, counter, blocked_until, updated_at
      ) values (
        ${bucketKey}, 'PARTICIPATION', ${windowStartedAt.toISOString()}::timestamptz,
        ${counter}, ${blockedUntil?.toISOString() ?? null}::timestamptz,
        ${now.toISOString()}::timestamptz
      )
      on conflict (bucket_key) do update set
        scope = excluded.scope,
        window_started_at = excluded.window_started_at,
        counter = excluded.counter,
        blocked_until = excluded.blocked_until,
        updated_at = excluded.updated_at
    `;
    return {
      blocked: blockedUntil !== null,
      retryAfterSeconds: blockedUntil ? PARTICIPATION_BLOCK_MS / 1000 : 0,
    };
  });
}
