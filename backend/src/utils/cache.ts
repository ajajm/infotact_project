import { redisClient, getRedisStatus } from '../config/redis.js';

export const cacheGet = async (key: string): Promise<any | null> => {
  if (!getRedisStatus()) return null;
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('⚠ Redis GET error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
  if (!getRedisStatus()) return;
  try {
    await redisClient.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
  } catch (error) {
    console.error('⚠ Redis SET error:', error);
  }
};

export const cacheFlushPattern = async (pattern: string): Promise<void> => {
  if (!getRedisStatus()) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`🧹 Flushed ${keys.length} keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    console.error('⚠ Redis DEL pattern error:', error);
  }
};
// SHA-256: crypto.createHash('sha256').update(prescriptionData).digest('hex')
