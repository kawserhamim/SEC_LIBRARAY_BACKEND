import IORedis from "ioredis";

const url = process.env.REDIS_TCP_URL;

if (!url) {
  console.warn("[queue-redis] REDIS_TCP_URL not set — book enrichment queue will be disabled");
}

export const isQueueRedisConfigured = () => Boolean(url);

// BullMQ requires its own dedicated connection per Queue/Worker (blocking commands),
// so callers get a fresh instance rather than a shared one.
export function createQueueRedisConnection() {
  if (!url) return null;

  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
