import { z } from 'zod';

/**
 * Risk levels for yield opportunities
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Protocol types supported by the platform
 */
export enum ProtocolType {
  LENDING = 'lending',
  LIQUIDITY_POOL = 'liquidity_pool',
  STAKING = 'staking',
  YIELD_FARMING = 'yield_farming',
  AUTO_COMPOUNDING = 'auto_compounding',
}

/**
 * Supported protocols
 */
export enum Protocol {
  VELAR = 'velar',
  ALEX = 'alex',
}

/**
 * User risk tolerance levels
 */
export enum RiskTolerance {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

/**
 * Yield opportunity data structure
 */
export const YieldOpportunitySchema = z.object({
  // Identification
  protocol: z.nativeEnum(Protocol),
  protocolType: z.nativeEnum(ProtocolType),
  poolId: z.string(),
  poolName: z.string(),

  // Yield metrics
  apy: z.number().min(0).max(10000), // Annual Percentage Yield (0-10000%)
  apyBreakdown: z
    .object({
      base: z.number().min(0), // Base yield from protocol
      rewards: z.number().min(0).optional(), // Token rewards
      fees: z.number().min(0).optional(), // Trading fees share
    })
    .optional(),

  // Liquidity metrics
  tvl: z.number().min(0), // Total Value Locked in USD
  tvlInSBTC: z.number().min(0), // TVL specifically in sBTC
  volume24h: z.number().min(0).optional(), // 24h trading volume (for DEX pools)

  // Risk assessment
  riskLevel: z.nativeEnum(RiskLevel),
  riskFactors: z.array(z.string()).optional(), // List of risk factors

  // Requirements and constraints
  minDeposit: z.number().min(0).optional(), // Minimum deposit in sats
  maxDeposit: z.number().min(0).optional(), // Maximum deposit in sats
  lockPeriod: z.number().min(0).optional(), // Lock period in days (0 = no lock)

  // Fees
  depositFee: z.number().min(0).max(100).default(0), // Percentage
  withdrawalFee: z.number().min(0).max(100).default(0), // Percentage
  performanceFee: z.number().min(0).max(100).default(0), // Percentage

  // Additional info
  impermanentLossRisk: z.boolean().default(false), // For LP positions
  auditStatus: z.enum(['audited', 'unaudited', 'in_progress']).optional(),
  protocolAge: z.number().min(0).optional(), // Age in days

  // Metadata
  contractAddress: z.string(),
  description: z.string().optional(),
  updatedAt: z.number(), // Unix timestamp
});

export type YieldOpportunity = z.infer<typeof YieldOpportunitySchema>;

/**
 * User preference schema for recommendations
 */
export const UserPreferenceSchema = z.object({
  amount: z.number().positive(), // Amount to invest in sats
  riskTolerance: z.nativeEnum(RiskTolerance),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
  preferredProtocols: z.array(z.nativeEnum(Protocol)).optional(),
  avoidImpermanentLoss: z.boolean().default(false),
  minApy: z.number().min(0).optional(),
  maxLockPeriod: z.number().min(0).optional(), // Maximum lock period in days
});

export type UserPreference = z.infer<typeof UserPreferenceSchema>;

/**
 * Alternative recommendation schema
 */
export const AlternativeRecommendationSchema = z.object({
  protocol: z.nativeEnum(Protocol),
  poolId: z.string(),
  poolName: z.string(),
  apy: z.number(),
  tvl: z.number(),
  pros: z.string(),
  cons: z.string(),
  riskLevel: z.nativeEnum(RiskLevel),
});

export type AlternativeRecommendation = z.infer<typeof AlternativeRecommendationSchema>;

/**
 * AI recommendation schema
 */
export const RecommendationSchema = z.object({
  // Primary recommendation
  protocol: z.nativeEnum(Protocol),
  poolId: z.string(),
  poolName: z.string(),
  expectedAPY: z.number().min(0),
  riskLevel: z.nativeEnum(RiskLevel),
  impermanentLossRisk: z.boolean(),

  // Analysis
  reasoning: z.string().min(50).max(500), // 2-3 sentences explaining recommendation
  riskAssessment: z.string().min(50).max(500), // Risk analysis

  // Alternatives
  alternatives: z.array(AlternativeRecommendationSchema).max(3),

  // Projections
  projectedEarnings: z.object({
    daily: z.number(),
    monthly: z.number(),
    yearly: z.number(),
  }),

  // Confidence
  confidenceScore: z.number().min(0).max(1), // 0-1 confidence in recommendation

  // Warnings
  warnings: z.array(z.string()).optional(),
  disclaimers: z
    .array(z.string())
    .default([
      'DeFi yields are volatile and not guaranteed',
      'Past performance does not indicate future results',
      'Only invest what you can afford to lose',
    ]),

  // Metadata
  generatedAt: z.number(), // Unix timestamp
  dataFreshness: z.number(), // Age of data in seconds
  source: z.enum(['ai', 'rule_based']), // Recommendation source
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Protocol aggregator response schema
 */
export const ProtocolDataSchema = z.object({
  protocol: z.nativeEnum(Protocol),
  opportunities: z.array(YieldOpportunitySchema),
  totalTVL: z.number(),
  fetchedAt: z.number(), // Unix timestamp
  success: z.boolean(),
  error: z.string().optional(),
});

export type ProtocolData = z.infer<typeof ProtocolDataSchema>;

/**
 * Aggregated yield data from all protocols
 */
export const AggregatedYieldDataSchema = z.object({
  protocols: z.array(ProtocolDataSchema),
  totalOpportunities: z.number(),
  totalTVL: z.number(),
  highestAPY: z
    .object({
      protocol: z.nativeEnum(Protocol),
      poolId: z.string(),
      apy: z.number(),
    })
    .optional(),
  lowestRisk: z
    .object({
      protocol: z.nativeEnum(Protocol),
      poolId: z.string(),
      tvl: z.number(),
    })
    .optional(),
  updatedAt: z.number(),
});

export type AggregatedYieldData = z.infer<typeof AggregatedYieldDataSchema>;

/**
 * Cache entry schema
 */
export const CacheEntrySchema = z.object({
  key: z.string(),
  data: z.unknown(),
  cachedAt: z.number(),
  expiresAt: z.number(),
  stale: z.boolean().default(false),
});

export type CacheEntry = z.infer<typeof CacheEntrySchema>;

/**
 * Health check response schema
 */
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.number(),
  services: z.object({
    cache: z.object({
      status: z.enum(['up', 'down']),
      latency: z.number().optional(),
    }),
    ai: z.object({
      status: z.enum(['up', 'down']),
      model: z.string().optional(),
    }),
    protocols: z.object({
      velar: z.enum(['up', 'down', 'unknown']),
      alex: z.enum(['up', 'down', 'unknown']),
    }),
  }),
  dataFreshness: z.object({
    oldestData: z.number().optional(), // Age in seconds
    stalest: z.string().optional(), // Which protocol has stalest data
  }),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
  timestamp: z.number(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * API response wrapper
 */
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ErrorResponseSchema.optional(),
    metadata: z.object({
      timestamp: z.number(),
      version: z.string().default('1.0.0'),
    }),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  metadata: {
    timestamp: number;
    version: string;
    dataSource?: {
      network: string;
      note?: string;
    };
  };
};
