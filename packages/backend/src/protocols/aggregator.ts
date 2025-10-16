import { createLogger } from '../config/logger.js';
import { velarDEX } from './velar.js';
import { alexProtocol } from './alex.js';
import {
  Protocol,
  type YieldOpportunity,
  type ProtocolData,
  type AggregatedYieldData,
} from '../types/yield.js';

const logger = createLogger('protocol-aggregator');

/**
 * Protocol Data Aggregator
 * Fetches and aggregates yield data from all supported protocols
 */
export class ProtocolAggregator {
  /**
   * Fetch yield opportunities from all protocols
   */
  async fetchAllOpportunities(): Promise<AggregatedYieldData> {
    logger.info('Fetching yield opportunities from all protocols');

    const startTime = Date.now();

    // Fetch from all protocols in parallel
    const [velarData, alexData] = await Promise.allSettled([
      this.fetchProtocolData(Protocol.VELAR, () => velarDEX.fetchYieldOpportunities()),
      this.fetchProtocolData(Protocol.ALEX, () => alexProtocol.fetchYieldOpportunities()),
    ]);

    // Extract protocol data
    const protocols: ProtocolData[] = [
      velarData.status === 'fulfilled'
        ? velarData.value
        : this.createErrorProtocolData(Protocol.VELAR, velarData.reason),
      alexData.status === 'fulfilled'
        ? alexData.value
        : this.createErrorProtocolData(Protocol.ALEX, alexData.reason),
    ];

    // Calculate aggregate statistics
    const allOpportunities = protocols.flatMap(p => p.opportunities);
    const totalOpportunities = allOpportunities.length;
    const totalTVL = protocols.reduce((sum, p) => sum + p.totalTVL, 0);

    // Find highest APY
    const highestAPY = this.findHighestAPY(allOpportunities);

    // Find lowest risk / highest TVL
    const lowestRisk = this.findLowestRisk(allOpportunities);

    const elapsed = Date.now() - startTime;
    logger.info(`Aggregated data from ${protocols.length} protocols in ${elapsed}ms`, {
      totalOpportunities,
      totalTVL,
      highestAPY: highestAPY?.apy,
      lowestRiskTVL: lowestRisk?.tvl,
    });

    return {
      protocols,
      totalOpportunities,
      totalTVL,
      highestAPY,
      lowestRisk,
      updatedAt: Date.now(),
    };
  }

  /**
   * Fetch data from a single protocol with error handling
   */
  private async fetchProtocolData(
    protocol: Protocol,
    fetchFn: () => Promise<YieldOpportunity[]>
  ): Promise<ProtocolData> {
    try {
      const opportunities = await fetchFn();
      const totalTVL = opportunities.reduce((sum, opp) => sum + opp.tvl, 0);

      logger.info(`Fetched ${opportunities.length} opportunities from ${protocol}`, {
        totalTVL,
      });

      return {
        protocol,
        opportunities,
        totalTVL,
        fetchedAt: Date.now(),
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to fetch data from ${protocol}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error; // Re-throw to be caught by Promise.allSettled
    }
  }

  /**
   * Create error protocol data for failed fetches
   */
  private createErrorProtocolData(protocol: Protocol, error: any): ProtocolData {
    return {
      protocol,
      opportunities: [],
      totalTVL: 0,
      fetchedAt: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * Find opportunity with highest APY
   */
  private findHighestAPY(opportunities: YieldOpportunity[]) {
    if (opportunities.length === 0) return undefined;

    const highest = opportunities.reduce((max, opp) => (opp.apy > max.apy ? opp : max));

    return {
      protocol: highest.protocol,
      poolId: highest.poolId,
      apy: highest.apy,
    };
  }

  /**
   * Find opportunity with lowest risk (highest TVL among low-risk options)
   */
  private findLowestRisk(opportunities: YieldOpportunity[]) {
    if (opportunities.length === 0) return undefined;

    // Filter for low/medium risk opportunities
    const lowRiskOpps = opportunities.filter(
      opp => opp.riskLevel === 'low' || opp.riskLevel === 'medium'
    );

    if (lowRiskOpps.length === 0) return undefined;

    // Find highest TVL among low-risk options
    const safest = lowRiskOpps.reduce((max, opp) => (opp.tvl > max.tvl ? opp : max));

    return {
      protocol: safest.protocol,
      poolId: safest.poolId,
      tvl: safest.tvl,
    };
  }

  /**
   * Filter opportunities by criteria
   */
  filterOpportunities(
    opportunities: YieldOpportunity[],
    criteria: {
      minAPY?: number;
      maxAPY?: number;
      minTVL?: number;
      maxRiskLevel?: string;
      protocols?: Protocol[];
      noImpermanentLoss?: boolean;
      maxLockPeriod?: number;
    }
  ): YieldOpportunity[] {
    return opportunities.filter(opp => {
      // APY filters
      if (criteria.minAPY !== undefined && opp.apy < criteria.minAPY) return false;
      if (criteria.maxAPY !== undefined && opp.apy > criteria.maxAPY) return false;

      // TVL filter
      if (criteria.minTVL !== undefined && opp.tvl < criteria.minTVL) return false;

      // Risk filter
      if (criteria.maxRiskLevel) {
        const riskLevels = ['low', 'medium', 'high'];
        const oppRiskIndex = riskLevels.indexOf(opp.riskLevel);
        const maxRiskIndex = riskLevels.indexOf(criteria.maxRiskLevel);
        if (oppRiskIndex > maxRiskIndex) return false;
      }

      // Protocol filter
      if (criteria.protocols && !criteria.protocols.includes(opp.protocol)) return false;

      // Impermanent loss filter
      if (criteria.noImpermanentLoss && opp.impermanentLossRisk) return false;

      // Lock period filter
      if (criteria.maxLockPeriod !== undefined) {
        const lockPeriod = opp.lockPeriod || 0;
        if (lockPeriod > criteria.maxLockPeriod) return false;
      }

      return true;
    });
  }

  /**
   * Sort opportunities by various criteria
   */
  sortOpportunities(
    opportunities: YieldOpportunity[],
    sortBy: 'apy' | 'tvl' | 'risk' | 'score',
    direction: 'asc' | 'desc' = 'desc'
  ): YieldOpportunity[] {
    const sorted = [...opportunities].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'apy':
          comparison = a.apy - b.apy;
          break;
        case 'tvl':
          comparison = a.tvl - b.tvl;
          break;
        case 'risk':
          const riskValues = { low: 1, medium: 2, high: 3 };
          comparison = riskValues[a.riskLevel] - riskValues[b.riskLevel];
          break;
        case 'score':
          // Risk-adjusted score: APY × log(TVL) × risk_factor
          const scoreA = this.calculateScore(a);
          const scoreB = this.calculateScore(b);
          comparison = scoreA - scoreB;
          break;
      }

      return direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Calculate risk-adjusted score for an opportunity
   */
  calculateScore(opp: YieldOpportunity): number {
    // Risk multipliers (lower is safer)
    const riskMultipliers = {
      low: 1.0,
      medium: 0.7,
      high: 0.4,
    };

    // Log scale for TVL (rewards higher liquidity)
    const tvlScore = Math.log10(Math.max(opp.tvl, 1000));

    // Calculate score
    const score = opp.apy * tvlScore * riskMultipliers[opp.riskLevel];

    return score;
  }

  /**
   * Get top N opportunities by score
   */
  getTopOpportunities(
    opportunities: YieldOpportunity[],
    limit: number = 5,
    riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): YieldOpportunity[] {
    // Apply risk filter based on tolerance
    const riskFilters = {
      conservative: ['low'],
      moderate: ['low', 'medium'],
      aggressive: ['low', 'medium', 'high'],
    };

    const filtered = opportunities.filter(opp =>
      riskFilters[riskTolerance].includes(opp.riskLevel)
    );

    // Sort by score and take top N
    const sorted = this.sortOpportunities(filtered, 'score', 'desc');

    return sorted.slice(0, limit);
  }
}

// Export singleton instance
export const protocolAggregator = new ProtocolAggregator();
export default protocolAggregator;
