import { createLogger } from '../config/logger.js';
import { config } from '../config/env.js';
import type { AlexYieldFarm } from '../types/protocols.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../types/yield.js';

const logger = createLogger('alex-protocol');

/**
 * ALEX Protocol Integration
 * Fetches sBTC staking and yield farming data from ALEX on Stacks
 */
export class AlexProtocolIntegration {
  private contractAddress: string;
  private contractName: string;

  constructor() {
    const contractId =
      config.protocols.alex || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-vault';
    const [address, name] = contractId.split('.');
    this.contractAddress = address;
    this.contractName = name;

    logger.info('ALEX Protocol integration initialized', {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
    });
  }

  /**
   * Fetch all sBTC yield opportunities from ALEX
   */
  async fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
    try {
      logger.info('Fetching ALEX yield farms');

      const farmIds = await this.getFarmIds();

      const opportunities: YieldOpportunity[] = [];

      for (const farmId of farmIds) {
        try {
          const farmData = await this.fetchFarmData(farmId);
          if (farmData) {
            const opportunity = this.transformToYieldOpportunity(farmData);
            opportunities.push(opportunity);
          }
        } catch (error) {
          logger.error(`Failed to fetch farm ${farmId}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(`Fetched ${opportunities.length} ALEX yield farms`);
      return opportunities;
    } catch (error) {
      logger.error('Failed to fetch ALEX opportunities', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get list of sBTC farm IDs
   */
  private async getFarmIds(): Promise<string[]> {
    try {
      // Mock farm IDs - in production, query from contract
      return ['sbtc-staking-farm', 'sbtc-alex-lp-farm', 'sbtc-auto-vault'];
    } catch (error) {
      logger.warn('Using fallback farm IDs');
      return ['sbtc-staking-farm'];
    }
  }

  /**
   * Fetch individual farm data
   */
  private async fetchFarmData(farmId: string): Promise<AlexYieldFarm | null> {
    try {
      const [farmType, baseApy, rewardApy, tvl, rewardData] = await Promise.all([
        this.getFarmType(farmId),
        this.getBaseAPY(farmId),
        this.getRewardAPY(farmId),
        this.getFarmTVL(farmId),
        this.getRewardData(farmId),
      ]);

      const boostedApy = rewardApy * 2.5; // Max boost typically 2.5x
      const totalApy = baseApy + rewardApy;

      return {
        farmId,
        farmName: this.getFarmName(farmId, farmType),
        contractAddress: `${this.contractAddress}.${this.contractName}`,
        type: farmType,
        stakingToken: 'sBTC',
        rewardToken: 'ALEX',
        baseApy,
        rewardApy,
        boostedApy,
        totalApy,
        totalStaked: tvl / 100000, // Convert to sBTC units
        totalStakedUsd: tvl,
        dailyRewards: rewardData.dailyRewards,
        rewardTokenPrice: rewardData.alexPrice,
        autoCompound: farmType === 'auto_vault',
        compoundFrequency: farmType === 'auto_vault' ? 12 : 0, // Every 12 hours
        boostMultiplier: 2.5,
        boostRequirement: 10000, // 10k ALEX tokens for max boost
      };
    } catch (error) {
      logger.error(`Failed to fetch farm data for ${farmId}`);
      return null;
    }
  }

  /**
   * Get farm type
   */
  private async getFarmType(farmId: string): Promise<'staking' | 'lp_farming' | 'auto_vault'> {
    if (farmId.includes('auto-vault')) return 'auto_vault';
    if (farmId.includes('lp')) return 'lp_farming';
    return 'staking';
  }

  /**
   * Get farm name
   */
  private getFarmName(farmId: string, type: string): string {
    const typeNames = {
      staking: 'sBTC Staking',
      lp_farming: 'sBTC-ALEX LP Farming',
      auto_vault: 'sBTC Auto-Compounding Vault',
    };
    return typeNames[type as keyof typeof typeNames] || `ALEX ${farmId}`;
  }

  /**
   * Get base APY (from staking/LP)
   */
  private async getBaseAPY(farmId: string): Promise<number> {
    try {
      // Mock implementation - in production, calculate from on-chain data
      if (farmId.includes('lp')) {
        return 8 + Math.random() * 7; // 8-15% for LP farming
      }
      return 3 + Math.random() * 4; // 3-7% for simple staking
    } catch (error) {
      logger.error(`Failed to get base APY for ${farmId}`);
      return 0;
    }
  }

  /**
   * Get ALEX reward APY
   */
  private async getRewardAPY(farmId: string): Promise<number> {
    try {
      // Mock implementation
      if (farmId.includes('auto-vault')) {
        return 12 + Math.random() * 8; // 12-20% for auto-vault
      }
      if (farmId.includes('lp')) {
        return 15 + Math.random() * 10; // 15-25% for LP
      }
      return 10 + Math.random() * 5; // 10-15% for staking
    } catch (error) {
      logger.error(`Failed to get reward APY for ${farmId}`);
      return 0;
    }
  }

  /**
   * Get farm TVL
   */
  private async getFarmTVL(farmId: string): Promise<number> {
    try {
      const btcPrice = 100000;
      const sbtcAmount = 30 + Math.random() * 120; // 30-150 sBTC
      return sbtcAmount * btcPrice;
    } catch (error) {
      logger.error(`Failed to get TVL for ${farmId}`);
      return 0;
    }
  }

  /**
   * Get reward token data
   */
  private async getRewardData(
    farmId: string
  ): Promise<{ dailyRewards: number; alexPrice: number }> {
    try {
      // Mock ALEX token price and daily rewards
      const alexPrice = 0.15 + Math.random() * 0.1; // $0.15-$0.25 per ALEX
      const dailyRewards = 10000 + Math.random() * 40000; // 10k-50k ALEX per day

      return { dailyRewards, alexPrice };
    } catch (error) {
      logger.error(`Failed to get reward data for ${farmId}`);
      return { dailyRewards: 0, alexPrice: 0 };
    }
  }

  /**
   * Transform ALEX farm data to standardized YieldOpportunity
   */
  private transformToYieldOpportunity(farm: AlexYieldFarm): YieldOpportunity {
    const riskLevel = this.calculateRiskLevel(farm);
    const protocolType = this.mapFarmTypeToProtocolType(farm.type);

    return {
      protocol: Protocol.ALEX,
      protocolType,
      poolId: farm.farmId,
      poolName: farm.farmName,

      apy: farm.totalApy,
      apyBreakdown: {
        base: farm.baseApy,
        rewards: farm.rewardApy,
      },

      tvl: farm.totalStakedUsd,
      tvlInSBTC: farm.totalStaked,

      riskLevel,
      riskFactors: this.identifyRiskFactors(farm),

      minDeposit: 5000000, // 0.05 sBTC in sats
      lockPeriod: farm.type === 'staking' ? 7 : 0, // 7 days for staking, none for LP/vault

      depositFee: 0,
      withdrawalFee: farm.type === 'auto_vault' ? 0.5 : 0, // 0.5% for auto-vault
      performanceFee: farm.type === 'auto_vault' ? 10 : 0, // 10% for auto-vault

      impermanentLossRisk: farm.type === 'lp_farming', // Only LP has IL risk
      auditStatus: 'audited',
      protocolAge: 365, // Mock: 1 year old

      contractAddress: farm.contractAddress,
      description: this.generateDescription(farm),
      updatedAt: Date.now(),
    };
  }

  /**
   * Map farm type to protocol type
   */
  private mapFarmTypeToProtocolType(farmType: string): ProtocolType {
    switch (farmType) {
      case 'staking':
        return ProtocolType.STAKING;
      case 'lp_farming':
        return ProtocolType.YIELD_FARMING;
      case 'auto_vault':
        return ProtocolType.AUTO_COMPOUNDING;
      default:
        return ProtocolType.STAKING;
    }
  }

  /**
   * Generate farm description
   */
  private generateDescription(farm: AlexYieldFarm): string {
    const baseDesc = `Earn ${farm.totalApy.toFixed(2)}% APY by ${farm.type === 'staking' ? 'staking sBTC' : farm.type === 'lp_farming' ? 'providing sBTC-ALEX liquidity' : 'depositing in auto-compounding vault'}. `;

    const rewardDesc = `Rewards: ${farm.baseApy.toFixed(2)}% base + ${farm.rewardApy.toFixed(2)}% in ALEX tokens. `;

    const boostDesc =
      farm.boostMultiplier > 1
        ? `Boost up to ${farm.boostedApy.toFixed(2)}% APY by staking ${farm.boostRequirement} ALEX tokens. `
        : '';

    const autoCompDesc = farm.autoCompound
      ? `Auto-compounds every ${farm.compoundFrequency} hours. `
      : '';

    return baseDesc + rewardDesc + boostDesc + autoCompDesc;
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(farm: AlexYieldFarm): RiskLevel {
    // LP farming has higher risk due to IL
    if (farm.type === 'lp_farming') return RiskLevel.HIGH;

    // Low TVL = higher risk
    if (farm.totalStakedUsd < 3000000) return RiskLevel.MEDIUM; // < $3M

    // Auto-vaults are generally lower risk
    if (farm.type === 'auto_vault') return RiskLevel.LOW;

    // Simple staking is medium risk
    return RiskLevel.MEDIUM;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(farm: AlexYieldFarm): string[] {
    const risks: string[] = [];

    // ALEX token price risk
    risks.push(
      `Rewards paid in ALEX tokens - subject to price volatility (current: $${farm.rewardTokenPrice.toFixed(3)})`
    );

    // Lock period risk
    if (farm.type === 'staking') {
      risks.push('7-day lock period - funds not accessible during this time');
    }

    // LP risk
    if (farm.type === 'lp_farming') {
      risks.push('Impermanent loss risk from sBTC-ALEX pair price divergence');
    }

    // Low TVL risk
    if (farm.totalStakedUsd < 3000000) {
      risks.push('Relatively low TVL - limited liquidity');
    }

    // Boost requirement
    if (farm.boostMultiplier > 1) {
      risks.push(`Requires ${farm.boostRequirement} ALEX tokens for maximum boost`);
    }

    return risks;
  }
}

// Export singleton instance
export const alexProtocol = new AlexProtocolIntegration();
export default alexProtocol;
