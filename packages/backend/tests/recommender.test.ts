import { describe, it, expect, beforeAll } from 'vitest';
import { fallbackRecommender } from '../src/ai/fallback.js';
import { protocolAggregator } from '../src/protocols/aggregator.js';
import {
  Protocol,
  ProtocolType,
  RiskLevel,
  RiskTolerance,
  type YieldOpportunity,
  type UserPreference,
} from '../src/types/yield.js';

// Mock yield opportunities for testing
const mockOpportunities: YieldOpportunity[] = [
  {
    protocol: Protocol.ZEST,
    protocolType: ProtocolType.LENDING,
    poolId: 'zest-sbtc-pool-1',
    poolName: 'Zest sBTC Lending Pool',
    apy: 8.5,
    tvl: 15000000, // $15M
    tvlInSBTC: 150,
    riskLevel: RiskLevel.LOW,
    depositFee: 0,
    withdrawalFee: 0,
    performanceFee: 10,
    impermanentLossRisk: false,
    auditStatus: 'audited',
    contractAddress: 'SP123.zest-protocol',
    updatedAt: Date.now(),
  },
  {
    protocol: Protocol.VELAR,
    protocolType: ProtocolType.LIQUIDITY_POOL,
    poolId: 'velar-sbtc-stx-pool',
    poolName: 'sBTC-STX LP',
    apy: 22.5,
    apyBreakdown: {
      base: 8,
      rewards: 14.5,
      fees: 8,
    },
    tvl: 8000000, // $8M
    tvlInSBTC: 80,
    volume24h: 500000,
    riskLevel: RiskLevel.HIGH,
    depositFee: 0,
    withdrawalFee: 0.1,
    performanceFee: 0,
    impermanentLossRisk: true,
    auditStatus: 'audited',
    contractAddress: 'SP456.velar-dex',
    updatedAt: Date.now(),
  },
  {
    protocol: Protocol.ALEX,
    protocolType: ProtocolType.STAKING,
    poolId: 'alex-sbtc-staking',
    poolName: 'sBTC Staking',
    apy: 12.0,
    apyBreakdown: {
      base: 5,
      rewards: 7,
    },
    tvl: 6000000, // $6M
    tvlInSBTC: 60,
    riskLevel: RiskLevel.MEDIUM,
    lockPeriod: 7,
    depositFee: 0,
    withdrawalFee: 0,
    performanceFee: 0,
    impermanentLossRisk: false,
    auditStatus: 'audited',
    contractAddress: 'SP789.alex-vault',
    updatedAt: Date.now(),
  },
];

describe('Fallback Recommender', () => {
  describe('Conservative Risk Tolerance', () => {
    it('should recommend low-risk option for conservative users', async () => {
      const userPreference: UserPreference = {
        amount: 100000000, // 1 BTC
        riskTolerance: RiskTolerance.CONSERVATIVE,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Should recommend Zest (low risk)
      expect(recommendation.protocol).toBe(Protocol.ZEST);
      expect(recommendation.riskLevel).toBe(RiskLevel.LOW);
      expect(recommendation.source).toBe('rule_based');
    });

    it('should avoid high-risk opportunities', async () => {
      const userPreference: UserPreference = {
        amount: 50000000, // 0.5 BTC
        riskTolerance: RiskTolerance.CONSERVATIVE,
        avoidImpermanentLoss: true,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Should not recommend Velar (high risk + IL)
      expect(recommendation.protocol).not.toBe(Protocol.VELAR);
      expect(recommendation.impermanentLossRisk).toBe(false);
    });
  });

  describe('Aggressive Risk Tolerance', () => {
    it('should consider high-APY options for aggressive users', async () => {
      const userPreference: UserPreference = {
        amount: 200000000, // 2 BTC
        riskTolerance: RiskTolerance.AGGRESSIVE,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Should allow high-risk, high-reward options
      expect(recommendation.expectedAPY).toBeGreaterThan(10);
      expect(recommendation.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('Moderate Risk Tolerance', () => {
    it('should balance risk and reward for moderate users', async () => {
      const userPreference: UserPreference = {
        amount: 150000000, // 1.5 BTC
        riskTolerance: RiskTolerance.MODERATE,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Should not be highest risk
      expect([RiskLevel.LOW, RiskLevel.MEDIUM]).toContain(recommendation.riskLevel);
      expect(recommendation.confidenceScore).toBeGreaterThan(0.3);
      expect(recommendation.confidenceScore).toBeLessThan(1.0);
    });
  });

  describe('Preference Filters', () => {
    it('should respect minimum APY preference', async () => {
      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.MODERATE,
        minApy: 10, // Minimum 10% APY
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      expect(recommendation.expectedAPY).toBeGreaterThanOrEqual(10);
    });

    it('should respect impermanent loss avoidance', async () => {
      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.AGGRESSIVE,
        avoidImpermanentLoss: true,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Should not recommend Velar (has IL risk)
      expect(recommendation.protocol).not.toBe(Protocol.VELAR);
    });

    it('should respect maximum lock period', async () => {
      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.MODERATE,
        maxLockPeriod: 0, // No lock period
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Should not recommend ALEX staking (7-day lock)
      expect(recommendation.lockPeriod || 0).toBe(0);
    });

    it('should respect preferred protocols', async () => {
      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.MODERATE,
        preferredProtocols: [Protocol.ZEST],
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      expect(recommendation.protocol).toBe(Protocol.ZEST);
    });
  });

  describe('Projected Earnings', () => {
    it('should calculate projected earnings correctly', async () => {
      const userPreference: UserPreference = {
        amount: 100000000, // 1 BTC
        riskTolerance: RiskTolerance.MODERATE,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      // Verify earnings structure
      expect(recommendation.projectedEarnings).toHaveProperty('daily');
      expect(recommendation.projectedEarnings).toHaveProperty('monthly');
      expect(recommendation.projectedEarnings).toHaveProperty('yearly');

      // Verify calculations
      const { yearly, monthly, daily } = recommendation.projectedEarnings;
      expect(yearly).toBeCloseTo(monthly * 12, 5);
      expect(yearly).toBeCloseTo(daily * 365, 5);
      expect(yearly).toBeGreaterThan(0);
    });
  });

  describe('Alternatives', () => {
    it('should provide alternative recommendations', async () => {
      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.MODERATE,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      expect(recommendation.alternatives.length).toBeGreaterThan(0);
      expect(recommendation.alternatives.length).toBeLessThanOrEqual(3);

      // Verify alternative structure
      const alt = recommendation.alternatives[0];
      expect(alt).toHaveProperty('protocol');
      expect(alt).toHaveProperty('poolId');
      expect(alt).toHaveProperty('apy');
      expect(alt).toHaveProperty('pros');
      expect(alt).toHaveProperty('cons');
    });
  });

  describe('Warnings and Disclaimers', () => {
    it('should include warnings for risky opportunities', async () => {
      const highRiskOpp: YieldOpportunity = {
        ...mockOpportunities[1],
        apy: 150, // Extremely high APY
      };

      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.AGGRESSIVE,
      };

      const recommendation = await fallbackRecommender.recommend(
        [highRiskOpp],
        userPreference
      );

      expect(recommendation.warnings?.length).toBeGreaterThan(0);
    });

    it('should always include disclaimers', async () => {
      const userPreference: UserPreference = {
        amount: 100000000,
        riskTolerance: RiskTolerance.MODERATE,
      };

      const recommendation = await fallbackRecommender.recommend(
        mockOpportunities,
        userPreference
      );

      expect(recommendation.disclaimers.length).toBeGreaterThan(0);
      expect(recommendation.disclaimers.some(d => d.includes('DeFi'))).toBe(true);
    });
  });
});

describe('Protocol Aggregator', () => {
  describe('Scoring System', () => {
    it('should score opportunities correctly', () => {
      const scores = mockOpportunities.map(opp =>
        protocolAggregator.calculateScore(opp)
      );

      expect(scores.length).toBe(3);
      scores.forEach(score => {
        expect(score).toBeGreaterThan(0);
      });
    });

    it('should sort opportunities by score', () => {
      const sorted = protocolAggregator.sortOpportunities(
        mockOpportunities,
        'score',
        'desc'
      );

      expect(sorted.length).toBe(mockOpportunities.length);

      // Verify descending order
      for (let i = 0; i < sorted.length - 1; i++) {
        const score1 = protocolAggregator.calculateScore(sorted[i]);
        const score2 = protocolAggregator.calculateScore(sorted[i + 1]);
        expect(score1).toBeGreaterThanOrEqual(score2);
      }
    });
  });

  describe('Filtering', () => {
    it('should filter by minimum TVL', () => {
      const filtered = protocolAggregator.filterOpportunities(
        mockOpportunities,
        { minTVL: 10000000 } // $10M minimum
      );

      filtered.forEach(opp => {
        expect(opp.tvl).toBeGreaterThanOrEqual(10000000);
      });
    });

    it('should filter by risk level', () => {
      const filtered = protocolAggregator.filterOpportunities(
        mockOpportunities,
        { maxRiskLevel: 'medium' }
      );

      filtered.forEach(opp => {
        expect(['low', 'medium']).toContain(opp.riskLevel);
      });
    });

    it('should filter by impermanent loss', () => {
      const filtered = protocolAggregator.filterOpportunities(
        mockOpportunities,
        { noImpermanentLoss: true }
      );

      filtered.forEach(opp => {
        expect(opp.impermanentLossRisk).toBe(false);
      });
    });
  });

  describe('Top Opportunities', () => {
    it('should return top N opportunities', () => {
      const top = protocolAggregator.getTopOpportunities(mockOpportunities, 2);

      expect(top.length).toBe(2);
    });

    it('should respect risk tolerance in top selection', () => {
      const conservativeTop = protocolAggregator.getTopOpportunities(
        mockOpportunities,
        3,
        'conservative'
      );

      conservativeTop.forEach(opp => {
        expect(opp.riskLevel).toBe('low');
      });
    });
  });
});
