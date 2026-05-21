import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: REDIS_URL,
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
  console.error('⚠ Redis Client Error:', err.message || err);
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  isRedisConnected = true;
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    isRedisConnected = true;
    console.log('✔ Redis connected successfully.');
  } catch (error) {
    console.error('⚠ Redis connection failed. Cache operations will be bypassed:', error);
    isRedisConnected = false;
  }
};

export const getRedisStatus = (): boolean => {
  return isRedisConnected;
};
// Signaling: offer/answer SDP events registered on socket connection
