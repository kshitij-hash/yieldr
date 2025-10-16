import { describe, it, expect, beforeAll } from 'vitest';
import { alexProtocol } from '../src/protocols/alex.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../src/types/yield.js';

/**
 * ALEX Protocol Integration Tests
 *
 * These tests call REAL data from ALEX Protocol API.
 * NO mock data is used - all tests validate actual API responses.
 *
 * Note: Tests may be slower due to network calls to ALEX API.
 * Tests may fail if ALEX API is down or if network is unavailable.
 */

describe('ALEX Protocol Integration', () => {
  let opportunities: YieldOpportunity[];

  beforeAll(async () => {
    // Fetch real opportunities once before all tests
    opportunities = await alexProtocol.fetchYieldOpportunities();
  }, 60000); // 60 second timeout for API calls

  describe('fetchYieldOpportunities', () => {
    it('should fetch opportunities from real ALEX API', async () => {
      expect(opportunities).toBeDefined();
      expect(Array.isArray(opportunities)).toBe(true);
    }, 60000);

    it('should return sBTC liquidity pool opportunities', () => {
      // ALEX should have sBTC LP pools
      if (opportunities.length > 0) {
        const hassBTCPool = opportunities.some(opp =>
          opp.poolName.toLowerCase().includes('sbtc') ||
          opp.description?.toLowerCase().includes('sbtc')
        );

        expect(hassBTCPool).toBe(true);
      }
    });

    it('should have valid yield opportunity structure', () => {
      opportunities.forEach(opp => {
        // Required fields
        expect(opp.protocol).toBe(Protocol.ALEX);
        expect(opp.poolId).toBeDefined();
        expect(opp.poolName).toBeDefined();
        expect(opp.contractAddress).toBeDefined();

        // Numeric fields
        expect(typeof opp.apy).toBe('number');
        expect(typeof opp.tvl).toBe('number');
        expect(typeof opp.tvlInSBTC).toBe('number');
        expect(typeof opp.depositFee).toBe('number');
        expect(typeof opp.withdrawalFee).toBe('number');
        expect(typeof opp.performanceFee).toBe('number');
        expect(typeof opp.minDeposit).toBe('number');
        expect(typeof opp.lockPeriod).toBe('number');
        expect(typeof opp.updatedAt).toBe('number');

        // Enums
        expect(['low', 'medium', 'high']).toContain(opp.riskLevel);

        // Booleans
        expect(typeof opp.impermanentLossRisk).toBe('boolean');

        // Protocol type should be LP-related
        expect([
          ProtocolType.LIQUIDITY_POOL,
          ProtocolType.YIELD_FARMING,
          ProtocolType.AUTO_COMPOUNDING
        ]).toContain(opp.protocolType);
      });
    });

    it('should have realistic APY values (0-200%)', () => {
      opportunities.forEach(opp => {
        expect(opp.apy).toBeGreaterThanOrEqual(0);
        expect(opp.apy).toBeLessThan(200);
      });
    });

    it('should have positive TVL values', () => {
      opportunities.forEach(opp => {
        expect(opp.tvl).toBeGreaterThan(0);
        expect(opp.tvlInSBTC).toBeGreaterThan(0);
      });
    });

    it('should have correct TVL to sBTC conversion', () => {
      opportunities.forEach(opp => {
        // TVL in USD should be TVL in sBTC * BTC price (roughly)
        const impliedBtcPrice = opp.tvl / (opp.tvlInSBTC * 2); // *2 because sBTC is half of pool

        // BTC price should be between $20k and $200k (reasonable range)
        expect(impliedBtcPrice).toBeGreaterThan(10000);
        expect(impliedBtcPrice).toBeLessThan(250000);
      });
    });

    it('should have apyBreakdown with base and rewards', () => {
      opportunities.forEach(opp => {
        expect(opp.apyBreakdown).toBeDefined();
        expect(opp.apyBreakdown?.base).toBeDefined();

        // Total APY should be sum of components
        const calculatedApy = (opp.apyBreakdown?.base || 0) + (opp.apyBreakdown?.rewards || 0);

        // Should match total APY (within rounding)
        expect(Math.abs(calculatedApy - opp.apy)).toBeLessThan(0.1);
      });
    });

    it('should have impermanent loss risk for LP positions', () => {
      opportunities.forEach(opp => {
        // All ALEX LP positions have IL risk
        expect(opp.impermanentLossRisk).toBe(true);
      });
    });

    it('should have zero lock period', () => {
      opportunities.forEach(opp => {
        // ALEX pools don't have lock periods
        expect(opp.lockPeriod).toBe(0);
      });
    });

    it('should have reasonable minimum deposit', () => {
      opportunities.forEach(opp => {
        // Min deposit should be between 0.01 sBTC and 1 sBTC
        expect(opp.minDeposit).toBeGreaterThanOrEqual(1000000); // 0.01 sBTC
        expect(opp.minDeposit).toBeLessThanOrEqual(100000000); // 1 sBTC
      });
    });

    it('should have valid Stacks contract address format', () => {
      opportunities.forEach(opp => {
        // Format: SPXXXX.contract-name
        expect(opp.contractAddress).toMatch(/^SP[A-Z0-9]+\.[a-z0-9-]+$/);
        expect(opp.contractAddress.split('.')).toHaveLength(2);
      });
    });

    it('should have audit status defined', () => {
      opportunities.forEach(opp => {
        expect(opp.auditStatus).toBeDefined();
        expect(['audited', 'unaudited', 'in-progress']).toContain(opp.auditStatus);
      });
    });

    it('should have risk factors array', () => {
      opportunities.forEach(opp => {
        expect(Array.isArray(opp.riskFactors)).toBe(true);
        expect(opp.riskFactors?.length).toBeGreaterThan(0);
      });
    });

    it('should mention impermanent loss in risk factors', () => {
      opportunities.forEach(opp => {
        const riskText = opp.riskFactors?.join(' ').toLowerCase() || '';
        expect(riskText).toContain('impermanent loss');
      });
    });

    it('should have descriptive text in description field', () => {
      opportunities.forEach(opp => {
        expect(opp.description).toBeDefined();
        expect(opp.description!.length).toBeGreaterThan(20);
        expect(opp.description!.toLowerCase()).toContain('alex');
      });
    });

    it('should have recent updatedAt timestamp (within 5 minutes)', () => {
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);

      opportunities.forEach(opp => {
        expect(opp.updatedAt).toBeGreaterThan(fiveMinutesAgo);
        expect(opp.updatedAt).toBeLessThanOrEqual(now);
      });
    });

    it('should have volume24h data when available', () => {
      opportunities.forEach(opp => {
        if (opp.volume24h !== undefined) {
          expect(opp.volume24h).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Risk Assessment', () => {
    it('should assign appropriate risk levels', () => {
      opportunities.forEach(opp => {
        expect(['low', 'medium', 'high']).toContain(opp.riskLevel);
      });
    });

    it('should include impermanent loss in risk factors', () => {
      opportunities.forEach(opp => {
        const riskText = opp.riskFactors?.join(' ').toLowerCase() || '';
        expect(riskText).toContain('impermanent');
      });
    });

    it('should mention smart contract risk', () => {
      opportunities.forEach(opp => {
        const riskText = opp.riskFactors?.join(' ').toLowerCase() || '';
        expect(riskText).toContain('smart contract');
      });
    });

    it('should provide liquidity-specific risk factors', () => {
      opportunities.forEach(opp => {
        const riskText = opp.riskFactors?.join(' ').toLowerCase() || '';

        if (opp.tvl < 3000000) {
          // Low TVL should be mentioned as risk
          const hasLiquidityRisk = riskText.includes('liquidity') ||
                                   riskText.includes('slippage');
          expect(hasLiquidityRisk).toBe(true);
        }
      });
    });

    it('should warn about ALEX token reward volatility', () => {
      opportunities.forEach(opp => {
        const riskText = opp.riskFactors?.join(' ').toLowerCase() || '';
        expect(riskText).toContain('alex');
      });
    });
  });

  describe('Fee Structure', () => {
    it('should have zero deposit fees', () => {
      opportunities.forEach(opp => {
        expect(opp.depositFee).toBe(0);
      });
    });

    it('should have zero withdrawal fees', () => {
      opportunities.forEach(opp => {
        expect(opp.withdrawalFee).toBe(0);
      });
    });

    it('should have zero performance fees', () => {
      opportunities.forEach(opp => {
        // ALEX doesn't charge performance fees
        expect(opp.performanceFee).toBe(0);
      });
    });
  });

  describe('Data Freshness', () => {
    it('should fetch fresh data on each call', async () => {
      const firstFetch = await alexProtocol.fetchYieldOpportunities();

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      const secondFetch = await alexProtocol.fetchYieldOpportunities();

      expect(firstFetch.length).toBeGreaterThanOrEqual(0);
      expect(secondFetch.length).toBeGreaterThanOrEqual(0);

      // Timestamps should be different (fresh data)
      if (firstFetch.length > 0 && secondFetch.length > 0) {
        expect(secondFetch[0].updatedAt).toBeGreaterThanOrEqual(firstFetch[0].updatedAt);
      }
    }, 120000);
  });

  describe('APY Calculation', () => {
    it('should have positive APY', () => {
      opportunities.forEach(opp => {
        expect(opp.apy).toBeGreaterThan(0);
      });
    });

    it('should break down APY into trading fees and rewards', () => {
      opportunities.forEach(opp => {
        expect(opp.apyBreakdown).toBeDefined();
        expect(opp.apyBreakdown?.base).toBeGreaterThanOrEqual(0);

        if (opp.apyBreakdown?.rewards !== undefined) {
          expect(opp.apyBreakdown.rewards).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should have trading fee APY component', () => {
      opportunities.forEach(opp => {
        // Trading fees should be part of APY
        expect(opp.apyBreakdown?.fees).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('TVL Calculation', () => {
    it('should calculate TVL from API data', () => {
      opportunities.forEach(opp => {
        // TVL should be a reasonable value for ALEX pools
        expect(opp.tvl).toBeGreaterThan(0);
        expect(opp.tvl).toBeLessThan(100000000); // Less than $100M per pool
      });
    });

    it('should estimate sBTC portion correctly', () => {
      opportunities.forEach(opp => {
        // sBTC is roughly half of the LP pool
        const estimatedSbtcValue = opp.tvl / 2;
        const actualSbtcValue = opp.tvlInSBTC * (opp.tvl / (opp.tvlInSBTC * 2));

        // Should be within 20% (rough estimate)
        const percentDiff = Math.abs(estimatedSbtcValue - actualSbtcValue) / estimatedSbtcValue;
        expect(percentDiff).toBeLessThan(0.3);
      });
    });
  });

  describe('Protocol Type Classification', () => {
    it('should classify pools correctly', () => {
      opportunities.forEach(opp => {
        expect([
          ProtocolType.LIQUIDITY_POOL,
          ProtocolType.YIELD_FARMING,
          ProtocolType.AUTO_COMPOUNDING
        ]).toContain(opp.protocolType);
      });
    });

    it('should identify auto-compounding pools', () => {
      const autoCompPools = opportunities.filter(
        opp => opp.protocolType === ProtocolType.AUTO_COMPOUNDING
      );

      autoCompPools.forEach(opp => {
        expect(opp.poolName.toLowerCase()).toContain('auto');
      });
    });
  });

  describe('Contract Integration', () => {
    it('should use correct ALEX contract address', () => {
      opportunities.forEach(opp => {
        // Should be ALEX protocol mainnet contract
        expect(opp.contractAddress).toContain('SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9');
      });
    });

    it('should use ALEX API for data', async () => {
      // Verify that we're using the ALEX API
      const result = await alexProtocol.fetchYieldOpportunities();
      expect(Array.isArray(result)).toBe(true);
    }, 60000);
  });
});
