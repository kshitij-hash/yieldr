import express, { Request, Response, NextFunction } from 'express';
import { config } from './config/env.js';
import { logger, createLogger } from './config/logger.js';
import { cache } from './cache/redis.js';
import { protocolAggregator } from './protocols/aggregator.js';
import { aiRecommender } from './ai/recommender.js';
import { fallbackRecommender } from './ai/fallback.js';
import { hiroClient } from './protocols/hiro-client.js';
import {
  UserPreferenceSchema,
  type ApiResponse,
  type AggregatedYieldData,
  type Recommendation,
  type HealthCheck,
  type ErrorResponse,
} from './types/yield.js';
import cors from 'cors';

const serverLogger = createLogger('server');

// Initialize Express app
const app = express();

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
        zest: hiroHealth.status === 'up' ? 'up' : 'down',
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
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await cache.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await cache.close();
  process.exit(0);
});

export default app;
