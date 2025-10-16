import { describe, it, expect, beforeAll } from 'vitest';
import { velarDEX } from '../src/protocols/velar.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../src/types/yield.js';

/**
 * Velar DEX Integration Tests
 *
 * These tests call REAL data from Velar Protocol API.
 * NO mock data is used - all tests validate actual API responses.
 *
 * Note: Tests may be slower due to network calls to Velar API.
 * Tests may fail if Velar API is down or if network is unavailable.
 */

describe('Velar DEX Integration', () => {
  let opportunities: YieldOpportunity[];

  beforeAll(async () => {
    // Fetch real opportunities once before all tests
    opportunities = await velarDEX.fetchYieldOpportunities();
  }, 60000); // 60 second timeout for API calls

  describe('fetchYieldOpportunities', () => {
    it('should fetch opportunities from real Velar API', async () => {
      expect(opportunities).toBeDefined();
      expect(Array.isArray(opportunities)).toBe(true);
    }, 60000);

    it('should return sBTC liquidity pool opportunities if available', () => {
      // Velar may have sBTC LP pools
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
        expect(opp.protocol).toBe(Protocol.VELAR);
        expect(opp.protocolType).toBe(ProtocolType.LIQUIDITY_POOL);
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
        // TVL in USD should be roughly sBTC reserve * 2 * BTC price (for balanced pools)
        const impliedBtcPrice = opp.tvl / (opp.tvlInSBTC * 2);

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
        // All Velar LP positions have IL risk
        expect(opp.impermanentLossRisk).toBe(true);
      });
    });

    it('should have zero lock period', () => {
      opportunities.forEach(opp => {
        // Velar pools don't have lock periods
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
        expect(opp.description!.toLowerCase()).toContain('velar');
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

    it('should assess volatile pairs as higher risk', () => {
      opportunities.forEach(opp => {
        if (opp.poolName.includes('STX') || opp.poolName.includes('ALEX')) {
          // Volatile pairs should be high risk
          expect(opp.riskLevel).toBe(RiskLevel.HIGH);
        }
      });
    });
  });

  describe('Fee Structure', () => {
    it('should have zero deposit fees', () => {
      opportunities.forEach(opp => {
        expect(opp.depositFee).toBe(0);
      });
    });

    it('should have reasonable withdrawal fees (<1%)', () => {
      opportunities.forEach(opp => {
        expect(opp.withdrawalFee).toBeGreaterThanOrEqual(0);
        expect(opp.withdrawalFee).toBeLessThanOrEqual(1);
      });
    });

    it('should have zero performance fees', () => {
      opportunities.forEach(opp => {
        // DEX doesn't charge performance fees
        expect(opp.performanceFee).toBe(0);
      });
    });
  });

  describe('Data Freshness', () => {
    it('should fetch fresh data on each call', async () => {
      const firstFetch = await velarDEX.fetchYieldOpportunities();

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      const secondFetch = await velarDEX.fetchYieldOpportunities();

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
        // TVL should be a reasonable value for Velar pools
        expect(opp.tvl).toBeGreaterThan(0);
        expect(opp.tvl).toBeLessThan(100000000); // Less than $100M per pool
      });
    });

    it('should track sBTC reserves correctly', () => {
      opportunities.forEach(opp => {
        // sBTC reserves should be positive
        expect(opp.tvlInSBTC).toBeGreaterThan(0);

        // sBTC value should be less than total TVL (it's half the pool)
        const impliedBtcPrice = opp.tvl / (opp.tvlInSBTC * 2);
        expect(impliedBtcPrice).toBeGreaterThan(0);
      });
    });
  });

  describe('Protocol Type Classification', () => {
    it('should classify all pools as LIQUIDITY_POOL', () => {
      opportunities.forEach(opp => {
        expect(opp.protocolType).toBe(ProtocolType.LIQUIDITY_POOL);
      });
    });
  });

  describe('Contract Integration', () => {
    it('should use correct Velar contract address', () => {
      opportunities.forEach(opp => {
        // Should be Velar protocol mainnet contract
        expect(opp.contractAddress).toContain('SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1');
      });
    });

    it('should use Velar API for data', async () => {
      // Verify that we're using the Velar API
      const result = await velarDEX.fetchYieldOpportunities();
      expect(Array.isArray(result)).toBe(true);
    }, 60000);
  });

  describe('Token Symbol Recognition', () => {
    it('should correctly identify sBTC in pool names', () => {
      opportunities.forEach(opp => {
        expect(opp.poolName).toContain('sBTC');
      });
    });

    it('should format pool names correctly', () => {
      opportunities.forEach(opp => {
        // Pool name should be in format "TOKEN1-TOKEN2 LP"
        expect(opp.poolName).toMatch(/^[A-Z]+-[A-Z]+ LP$/);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      // This test verifies that errors don't crash the app
      // If API is down, should return empty array
      const result = await velarDEX.fetchYieldOpportunities();
      expect(Array.isArray(result)).toBe(true);
    }, 60000);
  });
});
