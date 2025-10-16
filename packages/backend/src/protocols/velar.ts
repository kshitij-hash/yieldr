import { createLogger } from '../config/logger.js';
import { config } from '../config/env.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../types/yield.js';
import { priceOracle } from '../services/price-oracle.js';

const logger = createLogger('velar-dex');

// Velar API base URL
const VELAR_API_BASE = 'https://api.velar.co';

/**
 * Velar API Pool Response
 */
interface VelarPoolResponse {
  id: any;
  symbol: string;
  token0Symbol: string;
  token0ContractAddress: string;
  token1Symbol: string;
  token1ContractAddress: string;
  lpTokenContractAddress: string;
  stats: {
    apy: string;
    totalSupply: number;
    totalStaked: number;
    reserve0: number;
    reserve1: number;
    volume_usd: {
      value: number;
    };
    tvl_usd: {
      value: number;
      [key: string]: number;
    };
    fees_usd: {
      value: number;
    };
  };
}

/**
 * Velar API Response
 */
interface VelarAPIResponse {
  skip: number;
  limit: number;
  data: VelarPoolResponse[];
}

/**
 * Velar DEX Integration
 * Fetches sBTC liquidity pool data from Velar DEX API
 */
export class VelarDEXIntegration {
  private contractAddress: string;
  private contractName: string;

  constructor() {
    const contractId =
      config.protocols.velar || 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core';
    const [address, name] = contractId.split('.');
    this.contractAddress = address;
    this.contractName = name;

    logger.info('Velar DEX integration initialized', {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      apiBase: VELAR_API_BASE,
    });
  }

  /**
   * Fetch all sBTC liquidity pools from Velar API
   */
  async fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
    try {
      logger.info('Fetching Velar liquidity pools from API');

      // Fetch sBTC-related pools
      const pools = await this.fetchSBTCPools();

      const opportunities: YieldOpportunity[] = [];

      for (const poolData of pools) {
        try {
          const opportunity = await this.transformToYieldOpportunity(poolData);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          logger.error(`Failed to process pool ${poolData.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(`Fetched ${opportunities.length} Velar LP pools`);
      return opportunities;
    } catch (error) {
      logger.error('Failed to fetch Velar opportunities', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch sBTC pools from Velar API
   */
  private async fetchSBTCPools(): Promise<VelarPoolResponse[]> {
    try {
      const allPools = await this.fetchAllPools();

      // Filter for sBTC-related pools
      // Check both token symbols and contract addresses
      const sbtcPools = allPools.filter(pool => {
        const token0Lower = pool.token0ContractAddress.toLowerCase();
        const token1Lower = pool.token1ContractAddress.toLowerCase();
        const symbol0Lower = pool.token0Symbol.toLowerCase();
        const symbol1Lower = pool.token1Symbol.toLowerCase();

        return (
          token0Lower.includes('sbtc') ||
          token1Lower.includes('sbtc') ||
          symbol0Lower.includes('sbtc') ||
          symbol1Lower.includes('sbtc') ||
          token0Lower.includes('wsbtc') ||
          token1Lower.includes('wsbtc')
        );
      });

      logger.info(`Found ${sbtcPools.length} sBTC pools on Velar`, {
        pools: sbtcPools.map(p => p.symbol),
      });

      return sbtcPools;
    } catch (error) {
      logger.error('Failed to fetch sBTC pools', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch all pools from Velar API
   */
  private async fetchAllPools(): Promise<VelarPoolResponse[]> {
    const url = `${VELAR_API_BASE}/pools`;

    try {
      logger.debug('Fetching all pools from Velar API');

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const apiResponse = (await response.json()) as VelarAPIResponse;
      const pools = apiResponse.data || [];

      logger.debug('Fetched all pools', { count: pools.length });

      return pools;
    } catch (error) {
      logger.error('Failed to fetch all pools', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Transform Velar pool data to standardized YieldOpportunity
   */
  private async transformToYieldOpportunity(
    pool: VelarPoolResponse
  ): Promise<YieldOpportunity | null> {
    try {
      // Get BTC price for calculations
      const btcPrice = await priceOracle.getBitcoinPrice();

      // Extract stats
      const { stats } = pool;

      // Get TVL from API (already in USD)
      const tvl = stats.tvl_usd.value;

      // Calculate sBTC reserve from TVL breakdown (most accurate)
      // The TVL breakdown gives us the USD value of each token
      let sbtcValueUSD = 0;
      const sbtcContract = pool.token0ContractAddress.toLowerCase().includes('sbtc')
        ? pool.token0ContractAddress
        : pool.token1ContractAddress;

      // Get sBTC value from TVL breakdown
      if (stats.tvl_usd[sbtcContract]) {
        sbtcValueUSD = stats.tvl_usd[sbtcContract];
      } else {
        // Fallback: assume balanced pool
        sbtcValueUSD = tvl / 2;
      }

      // Convert USD value to BTC amount
      const sbtcReserve = sbtcValueUSD / btcPrice;

      // Get volume and fees from API (already in USD)
      const volume24h = stats.volume_usd.value;
      const fees24h = stats.fees_usd.value;

      // Calculate trading fee APY
      const tradingFeeApy = this.calculateTradingFeeAPY(fees24h, tvl);

      // Parse or estimate reward APY
      const rewardApy =
        stats.apy !== '--' ? parseFloat(stats.apy) : this.estimateRewardAPY(tvl);

      // Total APY
      const totalApy = tradingFeeApy + rewardApy;

      // Get token symbols
      const token0Symbol = pool.token0Symbol;
      const token1Symbol = pool.token1Symbol;

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(tvl, token1Symbol, volume24h);

      // Pool name
      const poolName = `${token0Symbol}-${token1Symbol} LP`;

      return {
        protocol: Protocol.VELAR,
        protocolType: ProtocolType.LIQUIDITY_POOL,
        poolId: pool.lpTokenContractAddress || pool.symbol,
        poolName,

        apy: totalApy,
        apyBreakdown: {
          base: tradingFeeApy,
          rewards: rewardApy,
          fees: tradingFeeApy,
        },

        tvl,
        tvlInSBTC: sbtcReserve,
        volume24h,

        riskLevel,
        riskFactors: this.identifyRiskFactors(tvl, token1Symbol, volume24h, totalApy),

        minDeposit: 5000000, // 0.05 sBTC in sats
        lockPeriod: 0, // No lock for LP

        depositFee: 0,
        withdrawalFee: 0.1, // Typical 0.1% withdrawal fee
        performanceFee: 0, // No performance fee for DEX

        impermanentLossRisk: true, // LP positions have IL risk
        auditStatus: 'audited',
        protocolAge: 240, // ~8 months (launched ~March 2024)

        contractAddress: `${this.contractAddress}.${this.contractName}`,
        description: `Provide ${poolName} liquidity on Velar to earn ${totalApy.toFixed(2)}% APY from trading fees (${tradingFeeApy.toFixed(2)}%) and VELAR rewards (${rewardApy.toFixed(2)}%). Warning: Subject to impermanent loss.`,
        updatedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to transform pool data', {
        poolSymbol: pool.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Calculate trading fee APY
   */
  private calculateTradingFeeAPY(fees24h: number, tvl: number): number {
    if (tvl === 0) return 0;
    const annualFees = fees24h * 365;
    return (annualFees / tvl) * 100;
  }

  /**
   * Estimate reward APY based on TVL
   */
  private estimateRewardAPY(tvl: number): number {
    // Velar provides VELAR token rewards
    // Higher TVL pools typically have lower reward APY
    if (tvl > 10000000) return 8; // > $10M
    if (tvl > 5000000) return 12; // > $5M
    if (tvl > 2000000) return 18; // > $2M
    return 25; // Small pools get higher rewards
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    tvl: number,
    token1Symbol: string,
    volume24h: number
  ): RiskLevel {
    // Volatile pairs = higher risk
    if (token1Symbol === 'STX' || token1Symbol === 'ALEX') {
      return RiskLevel.HIGH;
    }

    // Low liquidity = higher risk
    if (tvl < 1000000) return RiskLevel.HIGH; // < $1M
    if (tvl < 3000000) return RiskLevel.MEDIUM; // < $3M

    // Low volume = higher risk
    if (volume24h < 50000 && tvl > 0) {
      const turnover = volume24h / tvl;
      if (turnover < 0.01) return RiskLevel.MEDIUM; // < 1% daily turnover
    }

    // Stablecoin pairs = lower risk
    if (token1Symbol === 'USDA' || token1Symbol === 'USDC') {
      return RiskLevel.MEDIUM; // Still have some IL risk
    }

    return RiskLevel.MEDIUM; // Default for LP positions
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(
    tvl: number,
    token1Symbol: string,
    volume24h: number,
    apy: number
  ): string[] {
    const risks: string[] = [];

    // Impermanent loss warning
    risks.push('Impermanent loss risk from price divergence between assets');

    // Liquidity risk
    if (tvl < 1000000) {
      risks.push('Low liquidity - high slippage risk for large trades');
    }

    // Volatile pair risk
    if (token1Symbol === 'STX' || token1Symbol === 'ALEX') {
      risks.push('Volatile trading pair - higher impermanent loss risk');
    }

    // Volume risk
    if (volume24h < 100000) {
      risks.push('Low trading volume - yields may be lower than projected');
    }

    // High APY warning
    if (apy > 50) {
      risks.push('High APY may not be sustainable - reward emissions could decrease');
    }

    // Smart contract risk
    risks.push('Smart contract risk - always DYOR and only invest what you can afford to lose');

    return risks;
  }
}

// Export singleton instance
export const velarDEX = new VelarDEXIntegration();
export default velarDEX;
