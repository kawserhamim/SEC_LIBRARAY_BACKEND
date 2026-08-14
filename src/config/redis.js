import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error(
    "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in environment"
  );
}

export const redis = new Redis({ url, token });

// Test Redis connection
export const testRedisConnection = async () => {
  try {
    const result = await redis.ping();

    if (result === "PONG") {
      console.log("✅ Upstash Redis connected successfully");
      return true;
    }

    console.log("⚠️ Redis responded:", result);
    return false;
  } catch (error) {
    console.error("❌ Upstash Redis connection failed:", error.message);
    return false;
  }
};