import express, { Request, Response, NextFunction } from 'express';
import { config } from './config/env.js';
import { logger, createLogger } from './config/logger.js';
import { cache } from './cache/redis.js';
import { protocolAggregator } from './protocols/aggregator.js';
import { aiRecommender } from './ai/recommender.js';
import { fallbackRecommender } from './ai/fallback.js';
import { hiroClient } from './protocols/hiro-client.js';
import { bityieldService } from './services/bityield.js';
import { oracleSyncService } from './services/oracle-sync.js';
import {
  UserPreferenceSchema,
  type ApiResponse,
  type AggregatedYieldData,
  type Recommendation,
  type HealthCheck,
  type ErrorResponse,
} from './types/yield.js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const serverLogger = createLogger('server');

// Initialize Express app
const app = express();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: config.server.rateWindowMs, // Time window from config
  max: config.server.rateLimit, // Max requests per window from config
  message: {
    success: false,
    error: {
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later',
      timestamp: Date.now(),
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    serverLogger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: {
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later',
        timestamp: Date.now(),
      },
    });
  },
});

// Middleware
app.use(
  cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    serverLogger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    });
  });
  next();
});

/**
 * API Response helper
 */
function createResponse<T>(data?: T, error?: ErrorResponse): ApiResponse<T> {
  return {
    success: !error,
    data,
    error,
    metadata: {
      timestamp: Date.now(),
      version: '1.0.0',
      dataSource: {
        network: config.stacks.network,
        note: config.stacks.network === 'mainnet'
          ? 'Yield data from mainnet protocols. User deposits go to testnet vault.'
          : undefined,
      },
    },
  };
}

/**
 * Error handler middleware
 */
function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  serverLogger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  const errorResponse: ErrorResponse = {
    error: 'Internal Server Error',
    message: config.server.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: Date.now(),
  };

  res.status(500).json(createResponse(undefined, errorResponse));
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * POST /api/recommend
 * Get AI-powered yield recommendation
 */
app.post('/api/recommend', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    // Validate request body
    const userPreference = UserPreferenceSchema.parse(req.body);

    serverLogger.info('Recommendation request received', {
      amount: userPreference.amount,
      riskTolerance: userPreference.riskTolerance,
    });

    // Get yield opportunities (with caching)
    const yieldData = await cache.getOrSet<AggregatedYieldData>(
      'yield:all-opportunities',
      async () => await protocolAggregator.fetchAllOpportunities(),
      config.redis.ttl
    );

    const allOpportunities = yieldData.protocols.flatMap(p => p.opportunities);

    if (allOpportunities.length === 0) {
      throw new Error('No yield opportunities available at this time');
    }

    // Try AI recommendation first
    let recommendation: Recommendation;
    try {
      if (config.openai.fallbackEnabled) {
        recommendation = await aiRecommender.recommend(allOpportunities, userPreference);
      } else {
        throw new Error('AI disabled, using fallback');
      }
    } catch (aiError) {
      serverLogger.warn('AI recommendation failed, using fallback', {
        error: aiError instanceof Error ? aiError.message : String(aiError),
      });
      recommendation = await fallbackRecommender.recommend(allOpportunities, userPreference);
    }

    res.json(createResponse(recommendation));
  } catch (error) {
    if (error instanceof Error && error.message.includes('validation')) {
      const errorResponse: ErrorResponse = {
        error: 'Validation Error',
        message: error.message,
        timestamp: Date.now(),
      };
      res.status(400).json(createResponse(undefined, errorResponse));
    } else {
      _next(error);
    }
  }
});

/**
 * GET /api/yields
 * Get all available yield opportunities
 */
app.get('/api/yields', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    serverLogger.info('Yields request received');

    // Get from cache with stale fallback
    const { data: yieldData, stale } = await cache.getWithStaleFallback<AggregatedYieldData>(
      'yield:all-opportunities',
      async () => await protocolAggregator.fetchAllOpportunities(),
      config.redis.ttl
    );

    // Add metadata about data freshness
    const response = {
      ...yieldData,
      stale,
    };

    res.json(createResponse(response));
  } catch (error) {
    _next(error);
  }
});

/**
 * GET /api/yields/:protocol
 * Get yield opportunities for a specific protocol
 */
app.get(
  '/api/yields/:protocol',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { protocol } = req.params;
      serverLogger.info('Protocol yields request', { protocol });

      const yieldData = await cache.getOrSet<AggregatedYieldData>(
        'yield:all-opportunities',
        async () => await protocolAggregator.fetchAllOpportunities(),
        config.redis.ttl
      );

      const protocolData = yieldData.protocols.find(
        p => p.protocol.toLowerCase() === protocol.toLowerCase()
      );

      if (!protocolData) {
        const errorResponse: ErrorResponse = {
          error: 'Not Found',
          message: `Protocol '${protocol}' not found`,
          timestamp: Date.now(),
        };
        res.status(404).json(createResponse(undefined, errorResponse));
        return;
      }

      res.json(createResponse(protocolData));
    } catch (error) {
      _next(error);
    }
  }
);

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const [cacheHealth, aiHealth, hiroHealth] = await Promise.all([
    cache.healthCheck(),
    aiRecommender.healthCheck(),
    hiroClient.healthCheck(),
  ]);

  // Check cached data freshness
  const yieldDataEntry = await cache.getEntry('yield:all-opportunities');
  const oldestData = yieldDataEntry ? (Date.now() - yieldDataEntry.cachedAt) / 1000 : undefined;

  const health: HealthCheck = {
    status: cacheHealth.status === 'up' ? 'healthy' : 'degraded',
    timestamp: Date.now(),
    services: {
      cache: {
        status: cacheHealth.status,
        latency: cacheHealth.latency,
      },
      ai: {
        status: aiHealth.status,
        model: aiHealth.model,
      },
      protocols: {
        velar: hiroHealth.status === 'up' ? 'up' : 'down',
        alex: hiroHealth.status === 'up' ? 'up' : 'down',
      },
    },
    dataFreshness: {
      oldestData,
      stalest: oldestData && oldestData > 600 ? 'yield-data' : undefined,
    },
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(createResponse(health));
});

// ============================================================================
// BITYIELD API ROUTES
// ============================================================================

/**
 * GET /api/bityield/apy
 * Get current APY values from pool oracle
 */
app.get('/api/bityield/apy', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    serverLogger.info('BitYield APY request received');

    if (!bityieldService.isConfigured()) {
      const errorResponse: ErrorResponse = {
        error: 'Service Not Configured',
        message: 'BitYield contracts not configured. Please set environment variables.',
        timestamp: Date.now(),
      };
      res.status(503).json(createResponse(undefined, errorResponse));
      return;
    }

    const apyData = await cache.getOrSet(
      'bityield:apy',
      async () => await bityieldService.getPoolAPYs(),
      300 // 5 minutes TTL
    );

    const formatted = {
      alex: {
        apy: bityieldService.basisPointsToPercent(apyData.alexApy),
        apyFormatted: bityieldService.formatAPY(apyData.alexApy),
        basisPoints: apyData.alexApy,
      },
      velar: {
        apy: bityieldService.basisPointsToPercent(apyData.velarApy),
        apyFormatted: bityieldService.formatAPY(apyData.velarApy),
        basisPoints: apyData.velarApy,
      },
      lastUpdated: apyData.lastUpdated,
    };

    res.json(createResponse(formatted));
  } catch (error) {
    _next(error);
  }
});

/**
 * GET /api/bityield/tvl
 * Get total value locked in the vault
 */
app.get('/api/bityield/tvl', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    serverLogger.info('BitYield TVL request received');

    if (!bityieldService.isConfigured()) {
      const errorResponse: ErrorResponse = {
        error: 'Service Not Configured',
        message: 'BitYield contracts not configured. Please set environment variables.',
        timestamp: Date.now(),
      };
      res.status(503).json(createResponse(undefined, errorResponse));
      return;
    }

    const stats = await cache.getOrSet(
      'bityield:vault-stats',
      async () => await bityieldService.getVaultStats(),
      60 // 1 minute TTL
    );

    const formatted = {
      totalTvl: stats.totalTvl,
      totalTvlBTC: bityieldService.satsToBTC(stats.totalTvl),
      totalTvlFormatted: bityieldService.formatBTC(stats.totalTvl),
      depositorCount: stats.depositorCount,
      isPaused: stats.isPaused,
    };

    res.json(createResponse(formatted));
  } catch (error) {
    _next(error);
  }
});

/**
 * GET /api/bityield/pools
 * Get statistics for all pools
 */
app.get('/api/bityield/pools', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    serverLogger.info('BitYield pools request received');

    if (!bityieldService.isConfigured()) {
      const errorResponse: ErrorResponse = {
        error: 'Service Not Configured',
        message: 'BitYield contracts not configured. Please set environment variables.',
        timestamp: Date.now(),
      };
      res.status(503).json(createResponse(undefined, errorResponse));
      return;
    }

    const [alexStats, velarStats] = await Promise.all([
      cache.getOrSet('bityield:alex-pool', async () => await bityieldService.getPoolStats('alex'), 60),
      cache.getOrSet('bityield:velar-pool', async () => await bityieldService.getPoolStats('velar'), 60),
    ]);

    const formatted = {
      alex: {
        tvl: alexStats.tvl,
        tvlBTC: bityieldService.satsToBTC(alexStats.tvl),
        tvlFormatted: bityieldService.formatBTC(alexStats.tvl),
        apy: bityieldService.basisPointsToPercent(alexStats.apy),
        apyFormatted: bityieldService.formatAPY(alexStats.apy),
        isPaused: alexStats.isPaused,
      },
      velar: {
        tvl: velarStats.tvl,
        tvlBTC: bityieldService.satsToBTC(velarStats.tvl),
        tvlFormatted: bityieldService.formatBTC(velarStats.tvl),
        apy: bityieldService.basisPointsToPercent(velarStats.apy),
        apyFormatted: bityieldService.formatAPY(velarStats.apy),
        isPaused: velarStats.isPaused,
      },
      total: {
        tvl: alexStats.tvl + velarStats.tvl,
        tvlBTC: bityieldService.satsToBTC(alexStats.tvl + velarStats.tvl),
        tvlFormatted: bityieldService.formatBTC(alexStats.tvl + velarStats.tvl),
      },
    };

    res.json(createResponse(formatted));
  } catch (error) {
    _next(error);
  }
});

/**
 * GET /api/bityield/user/:address
 * Get user's balance and positions
 */
app.get('/api/bityield/user/:address', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { address } = req.params;
    serverLogger.info('BitYield user request', { address });

    if (!bityieldService.isConfigured()) {
      const errorResponse: ErrorResponse = {
        error: 'Service Not Configured',
        message: 'BitYield contracts not configured. Please set environment variables.',
        timestamp: Date.now(),
      };
      res.status(503).json(createResponse(undefined, errorResponse));
      return;
    }

    // Increased TTL to reduce API calls - user balance doesn't change frequently
    const balance = await cache.getOrSet(
      `bityield:user:${address}`,
      async () => await bityieldService.getUserBalance(address),
      300 // 5 minutes TTL for user data (reduced from 30s to minimize API calls)
    );

    const formatted = {
      vaultBalance: balance.vaultBalance,
      vaultBalanceBTC: bityieldService.satsToBTC(balance.vaultBalance),
      vaultBalanceFormatted: bityieldService.formatBTC(balance.vaultBalance),
      allocations: {
        alex: {
          amount: balance.alexAllocation,
          amountBTC: bityieldService.satsToBTC(balance.alexAllocation),
          amountFormatted: bityieldService.formatBTC(balance.alexAllocation),
          percentage: balance.vaultBalance > 0
            ? ((balance.alexAllocation / balance.vaultBalance) * 100).toFixed(2)
            : '0.00',
        },
        velar: {
          amount: balance.velarAllocation,
          amountBTC: bityieldService.satsToBTC(balance.velarAllocation),
          amountFormatted: bityieldService.formatBTC(balance.velarAllocation),
          percentage: balance.vaultBalance > 0
            ? ((balance.velarAllocation / balance.vaultBalance) * 100).toFixed(2)
            : '0.00',
        },
        total: balance.alexAllocation + balance.velarAllocation,
      },
      totalValueWithYield: {
        amount: balance.totalValueWithYield,
        amountBTC: bityieldService.satsToBTC(balance.totalValueWithYield),
        amountFormatted: bityieldService.formatBTC(balance.totalValueWithYield),
      },
      yield: {
        amount: balance.totalValueWithYield - balance.vaultBalance,
        amountBTC: bityieldService.satsToBTC(balance.totalValueWithYield - balance.vaultBalance),
        amountFormatted: bityieldService.formatBTC(balance.totalValueWithYield - balance.vaultBalance),
      },
      riskPreference: {
        value: balance.riskPreference,
        name: bityieldService.getRiskName(balance.riskPreference),
      },
    };

    res.json(createResponse(formatted));
  } catch (error) {
    _next(error);
  }
});

/**
 * GET /api/bityield/stats
 * Get comprehensive BitYield statistics
 */
app.get('/api/bityield/stats', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    serverLogger.info('BitYield comprehensive stats request');

    if (!bityieldService.isConfigured()) {
      const errorResponse: ErrorResponse = {
        error: 'Service Not Configured',
        message: 'BitYield contracts not configured. Please set environment variables.',
        timestamp: Date.now(),
      };
      res.status(503).json(createResponse(undefined, errorResponse));
      return;
    }

    // Fetch all data in parallel
    const [vaultStats, apyData, alexPool, velarPool] = await Promise.all([
      bityieldService.getVaultStats(),
      bityieldService.getPoolAPYs(),
      bityieldService.getPoolStats('alex'),
      bityieldService.getPoolStats('velar'),
    ]);

    const formatted = {
      vault: {
        tvl: vaultStats.totalTvl,
        tvlBTC: bityieldService.satsToBTC(vaultStats.totalTvl),
        tvlFormatted: bityieldService.formatBTC(vaultStats.totalTvl),
        depositors: vaultStats.depositorCount,
        isPaused: vaultStats.isPaused,
      },
      pools: {
        alex: {
          tvl: alexPool.tvl,
          tvlBTC: bityieldService.satsToBTC(alexPool.tvl),
          tvlFormatted: bityieldService.formatBTC(alexPool.tvl),
          apy: bityieldService.basisPointsToPercent(alexPool.apy),
          apyFormatted: bityieldService.formatAPY(alexPool.apy),
          isPaused: alexPool.isPaused,
        },
        velar: {
          tvl: velarPool.tvl,
          tvlBTC: bityieldService.satsToBTC(velarPool.tvl),
          tvlFormatted: bityieldService.formatBTC(velarPool.tvl),
          apy: bityieldService.basisPointsToPercent(velarPool.apy),
          apyFormatted: bityieldService.formatAPY(velarPool.apy),
          isPaused: velarPool.isPaused,
        },
        combined: {
          tvl: alexPool.tvl + velarPool.tvl,
          tvlBTC: bityieldService.satsToBTC(alexPool.tvl + velarPool.tvl),
        },
      },
      apy: {
        lastUpdated: apyData.lastUpdated,
      },
    };

    res.json(createResponse(formatted));
  } catch (error) {
    _next(error);
  }
});

/**
 * GET /api/bityield/oracle/status
 * Get oracle sync service status
 */
app.get('/api/bityield/oracle/status', (_req: Request, res: Response) => {
  const stats = oracleSyncService.getStats();
  const lastAPY = oracleSyncService.getLastAPY();
  const isRunning = oracleSyncService.isRunning();

  const status = {
    enabled: config.bityield.oracleSyncEnabled,
    running: isRunning,
    stats: {
      ...stats,
      lastSyncAttemptAgo: stats.lastSyncAttempt ? Date.now() - stats.lastSyncAttempt : null,
      lastSuccessfulSyncAgo: stats.lastSuccessfulSync
        ? Date.now() - stats.lastSuccessfulSync
        : null,
    },
    lastAPY: lastAPY
      ? {
          alex: {
            apy: lastAPY.alexApy / 100,
            apyFormatted: `${(lastAPY.alexApy / 100).toFixed(2)}%`,
            basisPoints: lastAPY.alexApy,
          },
          velar: {
            apy: lastAPY.velarApy / 100,
            apyFormatted: `${(lastAPY.velarApy / 100).toFixed(2)}%`,
            basisPoints: lastAPY.velarApy,
          },
        }
      : null,
  };

  res.json(createResponse(status));
});

/**
 * POST /api/bityield/oracle/sync
 * Force an immediate oracle sync (admin endpoint)
 */
app.post('/api/bityield/oracle/sync', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    serverLogger.info('Manual oracle sync requested');

    // if (!config.bityield.oracleSyncEnabled) {
    //   const errorResponse: ErrorResponse = {
    //     error: 'Service Disabled',
    //     message: 'Oracle sync service is not enabled. Set ORACLE_SYNC_ENABLED=true to enable.',
    //     timestamp: Date.now(),
    //   };
    //   res.status(503).json(createResponse(undefined, errorResponse));
    //   return;
    // }

    await oracleSyncService.forceSync();

    res.json(
      createResponse({
        message: 'Oracle sync completed',
        stats: oracleSyncService.getStats(),
        lastAPY: oracleSyncService.getLastAPY(),
      })
    );
  } catch (error) {
    _next(error);
  }
});

/**
 * DELETE /api/cache
 * Clear cache (admin endpoint - should be protected in production)
 */
app.delete('/api/cache', async (req: Request, res: Response): Promise<void> => {
  serverLogger.warn('Cache clear requested');

  const pattern = req.query.pattern as string | undefined;

  let cleared: number;
  if (pattern) {
    cleared = await cache.deletePattern(pattern);
  } else {
    await cache.flush();
    cleared = -1; // Indicates full flush
  }

  res.json(createResponse({ cleared, pattern: pattern || 'all' }));
});

/**
 * DELETE /api/bityield/cache/user/:address
 * Clear user-specific cache
 */
app.delete('/api/bityield/cache/user/:address', async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  serverLogger.info('User cache clear requested', { address });

  const cleared = await cache.deletePattern(`bityield:user:${address}`);

  res.json(createResponse({ cleared, address }));
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'BitYield AI Backend',
    version: '1.0.0',
    description: 'AI-powered sBTC yield optimization API',
    endpoints: {
      recommend: 'POST /api/recommend',
      yields: 'GET /api/yields',
      yieldsByProtocol: 'GET /api/yields/:protocol',
      health: 'GET /api/health',
      bityield: {
        apy: 'GET /api/bityield/apy',
        tvl: 'GET /api/bityield/tvl',
        pools: 'GET /api/bityield/pools',
        user: 'GET /api/bityield/user/:address',
        stats: 'GET /api/bityield/stats',
        oracleStatus: 'GET /api/bityield/oracle/status',
        oracleSync: 'POST /api/bityield/oracle/sync',
        clearUserCache: 'DELETE /api/bityield/cache/user/:address',
      },
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: Date.now(),
  };
  res.status(404).json(createResponse(undefined, errorResponse));
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = config.server.port;

app.listen(PORT, () => {
  logger.info(`BitYield backend server started`, {
    port: PORT,
    env: config.server.nodeEnv,
    openai: config.openai.model,
    redis: config.redis.url,
  });

  // Start oracle sync service if enabled
  if (config.bityield.oracleSyncEnabled) {
    logger.info('Starting oracle sync service', {
      interval: `${config.bityield.oracleSyncInterval / 1000}s`,
    });
    oracleSyncService.start();
  } else {
    logger.info('Oracle sync service disabled (set ORACLE_SYNC_ENABLED=true to enable)');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  oracleSyncService.stop();
  await cache.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  oracleSyncService.stop();
  await cache.close();
  process.exit(0);
});

export default app;
