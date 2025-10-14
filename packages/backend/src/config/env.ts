import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define environment schema with validation
const envSchema = z.object({
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  // Redis Configuration
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_TTL: z.string().transform(Number).pipe(z.number().positive()).default('600'),

  // Stacks Blockchain API
  STACKS_API_URL: z.string().url().default('https://api.hiro.so'),
  STACKS_NETWORK: z.enum(['mainnet', 'testnet']).default('mainnet'),

  // Server Configuration
  PORT: z.string().transform(Number).pipe(z.number().positive()).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Protocol Contract Addresses
  ZEST_PROTOCOL_CONTRACT: z.string().optional(),
  VELAR_DEX_CONTRACT: z.string().optional(),
  ALEX_PROTOCOL_CONTRACT: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Rate Limiting
  API_RATE_LIMIT: z.string().transform(Number).pipe(z.number().positive()).default('100'),
  API_RATE_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('60000'),

  // Cache Settings
  CACHE_REFRESH_INTERVAL: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('600000'),
  CACHE_STALE_THRESHOLD: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('1800000'),

  // AI Settings
  AI_TEMPERATURE: z.string().transform(Number).pipe(z.number().min(0).max(2)).default('0.3'),
  AI_MAX_TOKENS: z.string().transform(Number).pipe(z.number().positive()).default('1500'),
  AI_FALLBACK_ENABLED: z
    .string()
    .transform(v => v === 'true')
    .default('true'),

  // Safety Settings
  MAX_APY_THRESHOLD: z.string().transform(Number).pipe(z.number().positive()).default('1000'),
  MIN_TVL_FOR_RECOMMENDATION: z
    .string()
    .transform(Number)
    .pipe(z.number().positive())
    .default('1000000'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
};

export const env = parseEnv();

// Export typed config object
export const config = {
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    temperature: env.AI_TEMPERATURE,
    maxTokens: env.AI_MAX_TOKENS,
    fallbackEnabled: env.AI_FALLBACK_ENABLED,
  },
  redis: {
    url: env.REDIS_URL,
    ttl: env.REDIS_TTL,
    refreshInterval: env.CACHE_REFRESH_INTERVAL,
    staleThreshold: env.CACHE_STALE_THRESHOLD,
  },
  stacks: {
    apiUrl: env.STACKS_API_URL,
    network: env.STACKS_NETWORK,
  },
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    rateLimit: env.API_RATE_LIMIT,
    rateWindowMs: env.API_RATE_WINDOW_MS,
  },
  protocols: {
    zest: env.ZEST_PROTOCOL_CONTRACT,
    velar: env.VELAR_DEX_CONTRACT,
    alex: env.ALEX_PROTOCOL_CONTRACT,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  safety: {
    maxApyThreshold: env.MAX_APY_THRESHOLD,
    minTvlForRecommendation: env.MIN_TVL_FOR_RECOMMENDATION,
  },
} as const;

// Type exports
export type Config = typeof config;
export type Environment = z.infer<typeof envSchema>;
