#!/usr/bin/env tsx

/**
 * Contract Validation Script
 * Verifies that contract addresses exist and are accessible on Stacks mainnet
 */

import { config } from '../src/config/env.js';
import { hiroClient } from '../src/protocols/hiro-client.js';
import { logger } from '../src/config/logger.js';

async function validateContracts() {
  logger.info('Starting contract validation on Stacks...');
  logger.info(`Network: ${config.stacks.network}`);
  logger.info(`API: ${config.stacks.apiUrl}\n`);

  const contracts = [
    { name: 'Zest Protocol', address: config.protocols.zest },
    { name: 'Velar DEX', address: config.protocols.velar },
    { name: 'ALEX Protocol', address: config.protocols.alex },
  ];

  let errors = 0;
  let warnings = 0;

  for (const { name, address } of contracts) {
    if (!address) {
      logger.warn(`⚠ ${name}: No contract address configured`);
      warnings++;
      continue;
    }

    logger.info(`Validating ${name}: ${address}`);

    try {
      // Parse contract address
      const [contractAddr, contractName] = address.split('.');

      if (!contractAddr || !contractName) {
        logger.error(`  ✗ Invalid format (expected: SP....contract-name)`);
        errors++;
        continue;
      }

      // Try to get contract info from Hiro API
      try {
        const info = await hiroClient.getContractInfo(contractAddr, contractName);

        if (info) {
          logger.info(`  ✓ Contract found on chain`);
          logger.info(`  ✓ Deployer: ${contractAddr}`);
          logger.info(`  ✓ Contract: ${contractName}`);

          // Try to extract some contract details
          if (info.abi) {
            logger.info(`  ✓ ABI available: ${info.abi.functions?.length || 0} functions`);
          }
        } else {
          logger.warn(`  ⚠ Contract info not available`);
          warnings++;
        }
      } catch (apiError) {
        // API might fail but contract could still be valid
        logger.warn(`  ⚠ Could not fetch contract info: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        warnings++;
      }
    } catch (error) {
      logger.error(`  ✗ Validation failed: ${error instanceof Error ? error.message : String(error)}`);
      errors++;
    }

    logger.info(''); // Empty line between contracts
  }

  // Summary
  logger.info('='.repeat(50));
  if (errors === 0 && warnings === 0) {
    logger.info('✅ All contracts validated successfully!');
  } else {
    logger.info(`Validation complete: ${errors} errors, ${warnings} warnings`);
    if (errors > 0) {
      logger.error('❌ Fix errors before using these contracts');
    }
    if (warnings > 0) {
      logger.warn('⚠ Review warnings - some contracts may not be fully accessible');
    }
  }
  logger.info('='.repeat(50));

  process.exit(errors > 0 ? 1 : 0);
}

validateContracts().catch(error => {
  logger.error('Contract validation failed:', error);
  process.exit(1);
});
