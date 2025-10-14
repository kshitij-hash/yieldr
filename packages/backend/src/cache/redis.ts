import Redis from 'ioredis';
import { config } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import type { CacheEntry } from '../types/yield.js';

const logger = createLogger('redis-cache');

/**
 * Redis Cache Manager
 * Provides caching functionality with TTL and staleness detection
 */
export class RedisCache {
  private client: Redis;
  private defaultTTL: number;
  private staleThreshold: number;

  constructor() {
    this.client = new Redis(config.redis.url, {
      retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}`, { delay });
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.defaultTTL = config.redis.ttl; // seconds
    this.staleThreshold = config.redis.staleThreshold / 1000; // convert ms to seconds

    this.setupEventHandlers();

    logger.info('Redis cache initialized', {
      url: config.redis.url,
      defaultTTL: this.defaultTTL,
      staleThreshold: this.staleThreshold,
    });
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis connected');
    });

    this.client.on('error', error => {
      logger.error('Redis connection error', {
        error: error.message,
      });
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);

      if (!value) {
        logger.debug('Cache miss', { key });
        return null;
      }

      const parsed = JSON.parse(value);
      logger.debug('Cache hit', { key });
      return parsed as T;
    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get cache entry with metadata
   */
  async getEntry(key: string): Promise<CacheEntry | null> {
    try {
      const [data, ttl] = await Promise.all([this.client.get(key), this.client.ttl(key)]);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      const now = Date.now();
      const cachedAt = now - (this.defaultTTL - ttl) * 1000;
      const expiresAt = now + ttl * 1000;
      const age = (Date.now() - cachedAt) / 1000; // seconds
      const stale = age > this.staleThreshold;

      return {
        key,
        data: parsed,
        cachedAt,
        expiresAt,
        stale,
      };
    } catch (error) {
      logger.error('Cache get entry error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const cacheTTL = ttl || this.defaultTTL;

      await this.client.setex(key, cacheTTL, serialized);
      logger.debug('Cache set', { key, ttl: cacheTTL });
      return true;
    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      logger.debug('Cache delete', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      logger.info('Cache pattern delete', { pattern, deleted: result });
      return result;
    } catch (error) {
      logger.error('Cache delete pattern error', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key (in seconds)
   */
  async getTTL(key: string): Promise<number> {
    try {
      const ttl = await this.client.ttl(key);
      return ttl;
    } catch (error) {
      logger.error('Cache TTL error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return -1;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T = any>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch fresh data
    logger.debug('Cache miss, fetching fresh data', { key });
    const fresh = await fetchFn();

    // Store in cache
    await this.set(key, fresh, ttl);

    return fresh;
  }

  /**
   * Get with fallback to stale data
   * If cache is expired, return stale data while refreshing in background
   */
  async getWithStaleFallback<T = any>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<{ data: T; stale: boolean }> {
    const entry = await this.getEntry(key);

    // Cache hit with fresh data
    if (entry && !entry.stale) {
      return { data: entry.data as T, stale: false };
    }

    // Cache hit with stale data - return stale, refresh in background
    if (entry && entry.stale) {
      logger.info('Returning stale data, refreshing in background', { key });

      // Refresh in background (don't await)
      this.refreshInBackground(key, fetchFn, ttl);

      return { data: entry.data as T, stale: true };
    }

    // Cache miss - fetch fresh data
    logger.debug('Cache miss, fetching fresh data', { key });
    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);

    return { data: fresh, stale: false };
  }

  /**
   * Refresh data in background
   */
  private async refreshInBackground<T = any>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<void> {
    try {
      const fresh = await fetchFn();
      await this.set(key, fresh, ttl);
      logger.debug('Background refresh complete', { key });
    } catch (error) {
      logger.error('Background refresh failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async flush(): Promise<boolean> {
    try {
      await this.client.flushdb();
      logger.warn('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: string;
  }> {
    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbsize();
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        connected: this.client.status === 'ready',
        keys: keyCount,
        memory,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        connected: false,
        keys: 0,
        memory: 'unknown',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; latency?: number }> {
    const startTime = Date.now();

    try {
      await this.client.ping();
      const latency = Date.now() - startTime;

      logger.debug('Redis health check passed', { latency });
      return { status: 'up', latency };
    } catch (error) {
      logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'down' };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
    logger.info('Redis connection closed');
  }
}

// Export singleton instance
export const cache = new RedisCache();
export default cache;
