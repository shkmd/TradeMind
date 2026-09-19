import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * Shared ioredis connection. Only used by BullMQ queue definitions today —
 * no worker process consumes these queues yet (the import pipeline runs
 * synchronously in-request this phase). Wired now so a future worker can
 * be dropped in without touching pipeline.ts's signature.
 */
export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
