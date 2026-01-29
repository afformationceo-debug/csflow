import { Redis } from "@upstash/redis";

// Create Redis client only if env vars are available
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

// Cache keys
export const CACHE_KEYS = {
  tenant: (id: string) => `tenant:${id}`,
  conversation: (id: string) => `conversation:${id}`,
  customer: (id: string) => `customer:${id}`,
  userSessions: (userId: string) => `user:sessions:${userId}`,
  translationCache: (hash: string) => `translation:${hash}`,
  aiResponse: (hash: string) => `ai:response:${hash}`,
} as const;

// Cache TTL (seconds)
export const CACHE_TTL = {
  tenant: 3600, // 1 hour
  conversation: 300, // 5 minutes
  customer: 600, // 10 minutes
  translation: 86400, // 24 hours
  aiResponse: 1800, // 30 minutes
} as const;

// Helper functions
export async function getFromCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
}

export async function setToCache<T>(
  key: string,
  data: T,
  ttl: number = 300
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, data, { ex: ttl });
  } catch (error) {
    console.error("Cache set error:", error);
  }
}

export async function deleteFromCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Cache delete error:", error);
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("Cache invalidate error:", error);
  }
}

/**
 * Acquire a distributed lock (for preventing duplicate operations)
 * Returns true if lock was acquired, false if already locked
 */
export async function acquireLock(
  key: string,
  ttl: number = 300
): Promise<boolean> {
  if (!redis) return true; // If Redis not available, allow operation (fail-open)
  try {
    // SET with NX (only if not exists) and EX (expiry)
    const result = await redis.set(key, "locked", { nx: true, ex: ttl });
    return result === "OK";
  } catch (error) {
    console.error("Lock acquire error:", error);
    return true; // Fail-open: allow operation if Redis error
  }
}

/**
 * Release a distributed lock
 */
export async function releaseLock(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Lock release error:", error);
  }
}
