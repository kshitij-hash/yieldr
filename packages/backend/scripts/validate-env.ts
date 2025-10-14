#!/usr/bin/env tsx

/**
 * Environment Validation Script
 * Validates all required environment variables and connections
 */

import { config } from '../src/config/env.js';
import { cache } from '../src/cache/redis.js';
import { logger } from '../src/config/logger.js';

async function validateEnvironment() {
  logger.info('Starting environment validation...');

  let errors = 0;
  let warnings = 0;

  // 1. Validate OpenAI configuration
  logger.info('✓ Checking OpenAI configuration...');
  if (!config.openai.apiKey || config.openai.apiKey === 'sk-your-api-key-here') {
    logger.error('✗ OpenAI API key not set or using example value');
    errors++;
  } else if (!config.openai.apiKey.startsWith('sk-')) {
    logger.error('✗ OpenAI API key format invalid (should start with sk-)');
    errors++;
  } else {
    logger.info(`  ✓ API Key configured (${config.openai.apiKey.substring(0, 10)}...)`);
    logger.info(`  ✓ Model: ${config.openai.model}`);
  }

  // 2. Validate Redis configuration
  logger.info('✓ Checking Redis configuration...');
  logger.info(`  URL: ${config.redis.url}`);
  logger.info(`  TTL: ${config.redis.ttl}s`);

  try {
    const health = await cache.healthCheck();
    if (health.status === 'up') {
      logger.info(`  ✓ Redis connection successful (latency: ${health.latency}ms)`);
    } else {
      logger.error('  ✗ Redis connection failed');
      errors++;
    }
  } catch (error) {
    logger.error(`  ✗ Redis connection error: ${error instanceof Error ? error.message : String(error)}`);
    errors++;
  }

  // 3. Validate Stacks configuration
  logger.info('✓ Checking Stacks configuration...');
  logger.info(`  API URL: ${config.stacks.apiUrl}`);
  logger.info(`  Network: ${config.stacks.network}`);

  // 4. Validate protocol contract addresses
  logger.info('✓ Checking protocol contract addresses...');

  const contracts = [
    { name: 'Zest', address: config.protocols.zest },
    { name: 'Velar', address: config.protocols.velar },
    { name: 'ALEX', address: config.protocols.alex },
  ];

  contracts.forEach(({ name, address }) => {
    if (!address) {
      logger.warn(`  ⚠ ${name} contract address not configured`);
      warnings++;
    } else if (!address.match(/^SP[A-Z0-9]+\.[a-z0-9-]+$/)) {
      logger.error(`  ✗ ${name} contract address format invalid: ${address}`);
      errors++;
    } else {
      logger.info(`  ✓ ${name}: ${address}`);
    }
  });

  // 5. Validate server configuration
  logger.info('✓ Checking server configuration...');
  logger.info(`  Port: ${config.server.port}`);
  logger.info(`  Environment: ${config.server.nodeEnv}`);

  if (config.server.nodeEnv === 'production') {
    logger.warn('  ⚠ Running in production mode');
    if (config.logging.level === 'debug') {
      logger.warn('  ⚠ Debug logging enabled in production');
      warnings++;
    }
  }

  // 6. Validate safety settings
  logger.info('✓ Checking safety settings...');
  logger.info(`  Max APY threshold: ${config.safety.maxApyThreshold}%`);
  logger.info(`  Min TVL for recommendation: $${config.safety.minTvlForRecommendation.toLocaleString()}`);

  // Summary
  logger.info('\n' + '='.repeat(50));
  if (errors === 0 && warnings === 0) {
    logger.info('✅ All validations passed!');
  } else {
    logger.info(`Validation complete: ${errors} errors, ${warnings} warnings`);
    if (errors > 0) {
      logger.error('❌ Fix errors before running the server');
    }
  }
  logger.info('='.repeat(50));

  await cache.close();
  process.exit(errors > 0 ? 1 : 0);
}

validateEnvironment().catch(error => {
  logger.error('Validation script failed:', error);
  process.exit(1);
});
