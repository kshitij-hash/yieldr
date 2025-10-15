/**
 * Updated Velar DEX Integration - Real Data Implementation
 * Replaces the old mock implementation with real Velar API integration
 */

import { createLogger } from '../config/logger.js';
import { velarSBTCClient } from './velar-sbtc.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../types/yield.js';
import type { SBTCOpportunity } from '../types/sbtc.js';

const logger = createLogger('velar-real');

/**
 * Updated Velar DEX Integration with Real Data
 * Uses the VelarSBTCClient for actual API calls
 */
export class VelarRealIntegration {
  constructor() {
    logger.info('Velar Real Data integration initialized');
  }

  /**
   * Fetch all sBTC yield opportunities from Velar (Real Data)
   */
  async fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
    try {
      logger.info('Fetching real sBTC opportunities from Velar');

      // Get real sBTC opportunities
      const sbtcOpportunities = await velarSBTCClient.fetchSBTCOpportunities();

      // Transform to legacy YieldOpportunity format for compatibility
      const yieldOpportunities = sbtcOpportunities.map(this.transformSBTCToYieldOpportunity);

      logger.info(`Fetched ${yieldOpportunities.length} real opportunities from Velar`);
      return yieldOpportunities;
    } catch (error) {
      logger.error('Failed to fetch real Velar opportunities', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Transform sBTC opportunity to legacy YieldOpportunity format
   * Maintains compatibility with existing AI and aggregator systems
   */
  private transformSBTCToYieldOpportunity(sbtcOpp: SBTCOpportunity): YieldOpportunity {
    return {
      protocol: Protocol.VELAR,
      protocolType: sbtcOpp.type === 'liquidity_pool' ? ProtocolType.LIQUIDITY_POOL : ProtocolType.LENDING,
      poolId: sbtcOpp.id,
      poolName: sbtcOpp.name,

      apy: sbtcOpp.apy,
      apyBreakdown: {
        base: sbtcOpp.apy, // For LP pools, this includes trading fees
        rewards: 0, // Velar rewards would be separate if available
      },

      tvl: sbtcOpp.tvlUsd,
      tvlInSBTC: sbtcOpp.sbtcAmount,
      volume24h: 0, // Would need to be added to SBTCOpportunity if needed

      riskLevel: sbtcOpp.riskLevel === 'low' ? RiskLevel.LOW : 
                 sbtcOpp.riskLevel === 'medium' ? RiskLevel.MEDIUM : RiskLevel.HIGH,
      riskFactors: [], // Would need to be added to SBTCOpportunity if needed

      minDeposit: sbtcOpp.minDeposit,
      lockPeriod: sbtcOpp.lockPeriod,

      depositFee: sbtcOpp.fees.deposit,
      withdrawalFee: sbtcOpp.fees.withdrawal,
      performanceFee: sbtcOpp.fees.performance,

      impermanentLossRisk: sbtcOpp.impermanentLossRisk,
      auditStatus: 'audited' as const, // Velar is audited
      protocolAge: 365, // Velar has been running for about a year

      contractAddress: sbtcOpp.contractAddress,
      description: sbtcOpp.description,
      updatedAt: sbtcOpp.lastUpdated,
    };
  }

  /**
   * Health check using the real Velar client
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; latency?: number; error?: string }> {
    return await velarSBTCClient.healthCheck();
  }
}

// Export singleton instance
export const velarRealIntegration = new VelarRealIntegration();
export default velarRealIntegration;
