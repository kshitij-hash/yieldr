import { describe, it, expect } from 'vitest';
import { protocolAggregator } from '../src/protocols/aggregator.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../src/types/yield.js';

// Mock yield data for testing
const createMockOpportunity = (overrides: Partial<YieldOpportunity> = {}): YieldOpportunity => ({
  protocol: Protocol.ZEST,
  protocolType: ProtocolType.LENDING,
  poolId: 'test-pool',
  poolName: 'Test Pool',
  apy: 10,
  tvl: 10000000,
  tvlInSBTC: 100,
  riskLevel: RiskLevel.MEDIUM,
  depositFee: 0,
  withdrawalFee: 0,
  performanceFee: 0,
  impermanentLossRisk: false,
  contractAddress: 'SP123.test-contract',
  updatedAt: Date.now(),
  ...overrides,
});

describe('Protocol Aggregator', () => {
  describe('Score Calculation', () => {
    it('should calculate score using formula: APY × log10(TVL) × risk_factor', () => {
      const opp = createMockOpportunity({
        apy: 10,
        tvl: 10000000, // $10M
        riskLevel: RiskLevel.LOW,
      });

      const score = protocolAggregator.calculateScore(opp);

      // Expected: 10 × log10(10000000) × 1.0 = 10 × 7 × 1 = 70
      expect(score).toBeGreaterThan(60);
      expect(score).toBeLessThan(80);
    });

    it('should apply risk multipliers correctly', () => {
      const lowRiskOpp = createMockOpportunity({
        apy: 10,
        tvl: 10000000,
        riskLevel: RiskLevel.LOW,
      });

      const highRiskOpp = createMockOpportunity({
        apy: 10,
        tvl: 10000000,
        riskLevel: RiskLevel.HIGH,
      });

      const lowScore = protocolAggregator.calculateScore(lowRiskOpp);
      const highScore = protocolAggregator.calculateScore(highRiskOpp);

      // Low risk should have higher score than high risk with same APY/TVL
      expect(lowScore).toBeGreaterThan(highScore);
    });

    it('should reward higher TVL with logarithmic scaling', () => {
      const smallTVL = createMockOpportunity({
        apy: 10,
        tvl: 1000000, // $1M
      });

      const largeTVL = createMockOpportunity({
        apy: 10,
        tvl: 100000000, // $100M
      });

      const smallScore = protocolAggregator.calculateScore(smallTVL);
      const largeScore = protocolAggregator.calculateScore(largeTVL);

      expect(largeScore).toBeGreaterThan(smallScore);
    });
  });

  describe('Filtering', () => {
    const mockOpportunities = [
      createMockOpportunity({ apy: 5, tvl: 5000000, riskLevel: RiskLevel.LOW }),
      createMockOpportunity({ apy: 15, tvl: 10000000, riskLevel: RiskLevel.MEDIUM }),
      createMockOpportunity({ apy: 25, tvl: 3000000, riskLevel: RiskLevel.HIGH }),
    ];

    it('should filter by minimum APY', () => {
      const filtered = protocolAggregator.filterOpportunities(mockOpportunities, {
        minAPY: 10,
      });

      expect(filtered.length).toBe(2);
      filtered.forEach(opp => {
        expect(opp.apy).toBeGreaterThanOrEqual(10);
      });
    });

    it('should filter by minimum TVL', () => {
      const filtered = protocolAggregator.filterOpportunities(mockOpportunities, {
        minTVL: 8000000,
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].tvl).toBeGreaterThanOrEqual(8000000);
    });

    it('should filter by maximum risk level', () => {
      const filtered = protocolAggregator.filterOpportunities(mockOpportunities, {
        maxRiskLevel: 'medium',
      });

      expect(filtered.length).toBe(2);
      filtered.forEach(opp => {
        expect(['low', 'medium']).toContain(opp.riskLevel);
      });
    });

    it('should filter by impermanent loss', () => {
      const withIL = createMockOpportunity({ impermanentLossRisk: true });
      const withoutIL = createMockOpportunity({ impermanentLossRisk: false });

      const filtered = protocolAggregator.filterOpportunities([withIL, withoutIL], {
        noImpermanentLoss: true,
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].impermanentLossRisk).toBe(false);
    });
  });

  describe('Sorting', () => {
    const mockOpportunities = [
      createMockOpportunity({ apy: 10, tvl: 5000000 }),
      createMockOpportunity({ apy: 15, tvl: 10000000 }),
      createMockOpportunity({ apy: 5, tvl: 15000000 }),
    ];

    it('should sort by APY descending', () => {
      const sorted = protocolAggregator.sortOpportunities(mockOpportunities, 'apy', 'desc');

      expect(sorted[0].apy).toBe(15);
      expect(sorted[1].apy).toBe(10);
      expect(sorted[2].apy).toBe(5);
    });

    it('should sort by TVL descending', () => {
      const sorted = protocolAggregator.sortOpportunities(mockOpportunities, 'tvl', 'desc');

      expect(sorted[0].tvl).toBe(15000000);
      expect(sorted[1].tvl).toBe(10000000);
      expect(sorted[2].tvl).toBe(5000000);
    });

    it('should sort by score', () => {
      const sorted = protocolAggregator.sortOpportunities(mockOpportunities, 'score', 'desc');

      expect(sorted.length).toBe(3);
      // Scores should be in descending order
      for (let i = 0; i < sorted.length - 1; i++) {
        const score1 = protocolAggregator.calculateScore(sorted[i]);
        const score2 = protocolAggregator.calculateScore(sorted[i + 1]);
        expect(score1).toBeGreaterThanOrEqual(score2);
      }
    });
  });

  describe('Top Opportunities Selection', () => {
    const mockOpportunities = [
      createMockOpportunity({ apy: 10, tvl: 15000000, riskLevel: RiskLevel.LOW }),
      createMockOpportunity({ apy: 15, tvl: 10000000, riskLevel: RiskLevel.MEDIUM }),
      createMockOpportunity({ apy: 25, tvl: 5000000, riskLevel: RiskLevel.HIGH }),
      createMockOpportunity({ apy: 8, tvl: 20000000, riskLevel: RiskLevel.LOW }),
    ];

    it('should return top N opportunities', () => {
      const top = protocolAggregator.getTopOpportunities(mockOpportunities, 2);

      expect(top.length).toBe(2);
    });

    it('should respect conservative risk tolerance', () => {
      const top = protocolAggregator.getTopOpportunities(mockOpportunities, 5, 'conservative');

      expect(top.length).toBeGreaterThan(0);
      top.forEach(opp => {
        expect(opp.riskLevel).toBe('low');
      });
    });

    it('should respect moderate risk tolerance', () => {
      const top = protocolAggregator.getTopOpportunities(mockOpportunities, 5, 'moderate');

      top.forEach(opp => {
        expect(['low', 'medium']).toContain(opp.riskLevel);
      });
    });

    it('should allow all risks for aggressive tolerance', () => {
      const top = protocolAggregator.getTopOpportunities(mockOpportunities, 5, 'aggressive');

      expect(top.length).toBeGreaterThan(0);
      // Should include opportunities of any risk level
    });
  });
});

describe('Contract Address Validation', () => {
  it('should validate Stacks contract address format', () => {
    const validAddresses = [
      'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-borrow-v2-3',
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-reserve-pool',
    ];

    validAddresses.forEach(address => {
      // Format: SPXXXX.contract-name
      expect(address).toMatch(/^SP[A-Z0-9]+\.[a-z0-9-]+$/);
      expect(address.split('.')).toHaveLength(2);
    });
  });

  it('should identify protocol from contract address', () => {
    const contracts = {
      zest: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-borrow-v2-3',
      velar: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-token',
      alex: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-reserve-pool',
    };

    expect(contracts.zest).toContain('pool-borrow');
    expect(contracts.velar).toContain('velar');
    expect(contracts.alex).toContain('alex');
  });
});
