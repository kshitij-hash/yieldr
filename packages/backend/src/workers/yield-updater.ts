import cron from 'node-cron';
import { config } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { cache } from '../cache/redis.js';
import { protocolAggregator } from '../protocols/aggregator.js';
import type { AggregatedYieldData } from '../types/yield.js';

const logger = createLogger('yield-updater');

/**
 * Background Yield Data Updater Worker
 * Periodically fetches fresh yield data from all protocols and updates cache
 */
export class YieldUpdaterWorker {
  private isRunning: boolean = false;
  private lastUpdate: number = 0;
  private updateCount: number = 0;
  private errorCount: number = 0;

  /**
   * Start the background worker
   */
  start(): void {
    logger.info('Starting yield updater worker', {
      interval: config.redis.refreshInterval / 1000 + 's',
    });

    // Run immediately on start
    this.update();

    // Schedule periodic updates (every 10 minutes by default)
    const cronSchedule = this.getCronSchedule();
    cron.schedule(cronSchedule, () => {
      this.update();
    });

    logger.info('Yield updater worker started', {
      schedule: cronSchedule,
    });
  }

  /**
   * Get cron schedule based on refresh interval
   */
  private getCronSchedule(): string {
    const intervalMinutes = config.redis.refreshInterval / 60000;

    // Convert minutes to cron expression
    if (intervalMinutes >= 60) {
      const hours = Math.floor(intervalMinutes / 60);
      return `0 */${hours} * * *`; // Every N hours
    } else {
      return `*/${intervalMinutes} * * * *`; // Every N minutes
    }
  }

  /**
   * Perform update cycle
   */
  private async update(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Update already in progress, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting yield data update');

      // Fetch fresh data from all protocols
      const yieldData = await protocolAggregator.fetchAllOpportunities();

      // Validate data
      this.validateData(yieldData);

      // Update cache
      const cacheKey = 'yield:all-opportunities';
      const cached = await cache.set(cacheKey, yieldData, config.redis.ttl);

      if (!cached) {
        throw new Error('Failed to update cache');
      }

      // Also cache individual protocol data
      for (const protocol of yieldData.protocols) {
        await cache.set(`yield:protocol:${protocol.protocol}`, protocol, config.redis.ttl);
      }

      const duration = Date.now() - startTime;
      this.updateCount++;
      this.lastUpdate = Date.now();

      logger.info('Yield data update completed', {
        duration,
        opportunities: yieldData.totalOpportunities,
        totalTVL: yieldData.totalTVL,
        protocols: yieldData.protocols.length,
        updateCount: this.updateCount,
      });

      // Log anomalies
      this.checkForAnomalies(yieldData);
    } catch (error) {
      this.errorCount++;
      logger.error('Yield data update failed', {
        error: error instanceof Error ? error.message : String(error),
        errorCount: this.errorCount,
      });

      // If too many consecutive errors, alert
      if (this.errorCount > 3) {
        logger.error('Multiple consecutive update failures detected', {
          errorCount: this.errorCount,
        });
        // In production, send alert to monitoring service
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Validate fetched data
   */
  private validateData(data: AggregatedYieldData): void {
    if (!data.protocols || data.protocols.length === 0) {
      throw new Error('No protocol data available');
    }

    // Check for successful fetches
    const successfulProtocols = data.protocols.filter(p => p.success);
    if (successfulProtocols.length === 0) {
      throw new Error('All protocol fetches failed');
    }

    // Warn if some protocols failed
    const failedProtocols = data.protocols.filter(p => !p.success);
    if (failedProtocols.length > 0) {
      logger.warn('Some protocols failed to fetch', {
        failed: failedProtocols.map(p => p.protocol),
      });
    }

    // Validate opportunity data
    const allOpportunities = data.protocols.flatMap(p => p.opportunities);
    if (allOpportunities.length === 0) {
      throw new Error('No yield opportunities found');
    }

    // Sanity check APYs
    const invalidAPYs = allOpportunities.filter(
      opp => opp.apy < 0 || opp.apy > config.safety.maxApyThreshold
    );

    if (invalidAPYs.length > 0) {
      logger.warn('Found opportunities with suspicious APYs', {
        count: invalidAPYs.length,
        examples: invalidAPYs.slice(0, 3).map(opp => ({
          protocol: opp.protocol,
          poolId: opp.poolId,
          apy: opp.apy,
        })),
      });
    }
  }

  /**
   * Check for anomalies in the data
   */
  private checkForAnomalies(data: AggregatedYieldData): void {
    const allOpportunities = data.protocols.flatMap(p => p.opportunities);

    // Check for unusually high APYs
    const highAPYs = allOpportunities.filter(
      opp => opp.apy > config.safety.maxApyThreshold * 0.5 // 50% of max threshold
    );

    if (highAPYs.length > 0) {
      logger.warn('Detected unusually high APYs', {
        count: highAPYs.length,
        highest: Math.max(...highAPYs.map(o => o.apy)),
      });
    }

    // Check for very low TVL
    const lowTVL = allOpportunities.filter(
      opp => opp.tvl < config.safety.minTvlForRecommendation * 0.1
    );

    if (lowTVL.length > 0) {
      logger.warn('Detected opportunities with very low TVL', {
        count: lowTVL.length,
      });
    }

    // Check data freshness
    const now = Date.now();
    const staleData = allOpportunities.filter(
      opp => now - opp.updatedAt > config.redis.staleThreshold
    );

    if (staleData.length > 0) {
      logger.warn('Some opportunities have stale data', {
        count: staleData.length,
      });
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    isRunning: boolean;
    lastUpdate: number;
    updateCount: number;
    errorCount: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      updateCount: this.updateCount,
      errorCount: this.errorCount,
      uptime: Date.now() - this.lastUpdate,
    };
  }

  /**
   * Manually trigger an update
   */
  async triggerUpdate(): Promise<void> {
    logger.info('Manual update triggered');
    await this.update();
  }
}

// Create and start worker if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = new YieldUpdaterWorker();
  worker.start();

  logger.info('Yield updater worker running in standalone mode');

  // Handle shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker');
    await cache.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down worker');
    await cache.close();
    process.exit(0);
  });
}

// Export singleton instance
export const yieldUpdater = new YieldUpdaterWorker();
export default yieldUpdater;
