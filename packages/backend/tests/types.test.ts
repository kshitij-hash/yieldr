import { describe, it, expect } from 'vitest';
import {
  YieldOpportunitySchema,
  UserPreferenceSchema,
  RecommendationSchema,
  Protocol,
  RiskLevel,
  RiskTolerance,
  ProtocolType,
} from '../src/types/yield.js';

describe('Type Validation with Zod', () => {
  describe('YieldOpportunitySchema', () => {
    it('should validate correct yield opportunity', () => {
      const validOpp = {
        protocol: Protocol.ZEST,
        protocolType: ProtocolType.LENDING,
        poolId: 'test-pool',
        poolName: 'Test Pool',
        apy: 10.5,
        tvl: 10000000,
        tvlInSBTC: 100,
        riskLevel: RiskLevel.MEDIUM,
        depositFee: 0,
        withdrawalFee: 0,
        performanceFee: 10,
        impermanentLossRisk: false,
        contractAddress: 'SP123.test',
        updatedAt: Date.now(),
      };

      const result = YieldOpportunitySchema.safeParse(validOpp);
      expect(result.success).toBe(true);
    });

    it('should reject invalid APY', () => {
      const invalidOpp = {
        protocol: Protocol.ZEST,
        protocolType: ProtocolType.LENDING,
        poolId: 'test',
        poolName: 'Test',
        apy: -5, // Negative APY
        tvl: 1000000,
        tvlInSBTC: 10,
        riskLevel: RiskLevel.LOW,
        depositFee: 0,
        withdrawalFee: 0,
        performanceFee: 0,
        impermanentLossRisk: false,
        contractAddress: 'SP123.test',
        updatedAt: Date.now(),
      };

      const result = YieldOpportunitySchema.safeParse(invalidOpp);
      expect(result.success).toBe(false);
    });

    it('should reject APY above 10000%', () => {
      const invalidOpp = {
        protocol: Protocol.ZEST,
        protocolType: ProtocolType.LENDING,
        poolId: 'test',
        poolName: 'Test',
        apy: 15000, // Unrealistic APY
        tvl: 1000000,
        tvlInSBTC: 10,
        riskLevel: RiskLevel.HIGH,
        depositFee: 0,
        withdrawalFee: 0,
        performanceFee: 0,
        impermanentLossRisk: false,
        contractAddress: 'SP123.test',
        updatedAt: Date.now(),
      };

      const result = YieldOpportunitySchema.safeParse(invalidOpp);
      expect(result.success).toBe(false);
    });
  });

  describe('UserPreferenceSchema', () => {
    it('should validate correct user preferences', () => {
      const validPref = {
        amount: 100000000,
        riskTolerance: RiskTolerance.MODERATE,
        timeHorizon: 'long' as const,
        minApy: 5,
        maxLockPeriod: 7,
        avoidImpermanentLoss: true,
      };

      const result = UserPreferenceSchema.safeParse(validPref);
      expect(result.success).toBe(true);
    });

    it('should require positive amount', () => {
      const invalidPref = {
        amount: -100,
        riskTolerance: RiskTolerance.MODERATE,
      };

      const result = UserPreferenceSchema.safeParse(invalidPref);
      expect(result.success).toBe(false);
    });

    it('should require valid risk tolerance', () => {
      const invalidPref = {
        amount: 100000000,
        riskTolerance: 'invalid' as any,
      };

      const result = UserPreferenceSchema.safeParse(invalidPref);
      expect(result.success).toBe(false);
    });
  });

  describe('RecommendationSchema', () => {
    it('should validate complete recommendation', () => {
      const validRec = {
        protocol: Protocol.ZEST,
        poolId: 'test-pool',
        poolName: 'Test Pool',
        expectedAPY: 10,
        riskLevel: RiskLevel.MEDIUM,
        impermanentLossRisk: false,
        reasoning: 'This is a test reasoning that is long enough to pass validation',
        riskAssessment: 'This is a test risk assessment that is long enough too',
        alternatives: [],
        projectedEarnings: {
          daily: 0.001,
          monthly: 0.03,
          yearly: 0.36,
        },
        confidenceScore: 0.8,
        generatedAt: Date.now(),
        dataFreshness: 300,
        source: 'rule_based' as const,
      };

      const result = RecommendationSchema.safeParse(validRec);
      expect(result.success).toBe(true);
    });

    it('should require reasoning to be at least 50 characters', () => {
      const invalidRec = {
        protocol: Protocol.ZEST,
        poolId: 'test',
        poolName: 'Test',
        expectedAPY: 10,
        reasoning: 'Too short', // Less than 50 chars
        riskAssessment: 'This is a test risk assessment that is long enough',
        alternatives: [],
        projectedEarnings: { daily: 0.1, monthly: 3, yearly: 36 },
        confidenceScore: 0.8,
        generatedAt: Date.now(),
        dataFreshness: 300,
        source: 'ai' as const,
      };

      const result = RecommendationSchema.safeParse(invalidRec);
      expect(result.success).toBe(false);
    });

    it('should require confidence score between 0 and 1', () => {
      const invalidRec = {
        protocol: Protocol.ZEST,
        poolId: 'test',
        poolName: 'Test',
        expectedAPY: 10,
        reasoning: 'This is a valid reasoning that is long enough for validation',
        riskAssessment: 'This is a valid risk assessment that is long enough',
        alternatives: [],
        projectedEarnings: { daily: 0.1, monthly: 3, yearly: 36 },
        confidenceScore: 1.5, // Invalid: > 1
        generatedAt: Date.now(),
        dataFreshness: 300,
        source: 'ai' as const,
      };

      const result = RecommendationSchema.safeParse(invalidRec);
      expect(result.success).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    it('should validate Protocol enum', () => {
      expect(Object.values(Protocol)).toContain('zest');
      expect(Object.values(Protocol)).toContain('velar');
      expect(Object.values(Protocol)).toContain('alex');
    });

    it('should validate RiskLevel enum', () => {
      expect(Object.values(RiskLevel)).toContain('low');
      expect(Object.values(RiskLevel)).toContain('medium');
      expect(Object.values(RiskLevel)).toContain('high');
    });

    it('should validate RiskTolerance enum', () => {
      expect(Object.values(RiskTolerance)).toContain('conservative');
      expect(Object.values(RiskTolerance)).toContain('moderate');
      expect(Object.values(RiskTolerance)).toContain('aggressive');
    });

    it('should validate ProtocolType enum', () => {
      expect(Object.values(ProtocolType)).toContain('lending');
      expect(Object.values(ProtocolType)).toContain('liquidity_pool');
      expect(Object.values(ProtocolType)).toContain('staking');
      expect(Object.values(ProtocolType)).toContain('yield_farming');
    });
  });
});
