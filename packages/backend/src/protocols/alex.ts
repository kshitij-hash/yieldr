import { createLogger } from '../config/logger.js';
import { config } from '../config/env.js';
import { Protocol, ProtocolType, RiskLevel, type YieldOpportunity } from '../types/yield.js';
import { priceOracle } from '../services/price-oracle.js';

const logger = createLogger('alex-protocol');

// ALEX API base URL
const ALEX_API_BASE = 'https://api.alexgo.io';

/**
 * ALEX API Swap Pair Response
 */
interface AlexSwapPair {
  id: number; // pool_token_id
  base?: string; // token contract name
  baseSymbol?: string; // human-readable symbol
  baseId?: string; // full contract ID
  quote?: string; // token contract name
  quoteSymbol?: string; // human-readable symbol
  quoteId?: string; // full contract ID
  baseVolume?: number;
  quoteVolume?: number;
  lastBasePriceInUSD?: number;
  lastQuotePriceInUSD?: number;
}

/**
 * ALEX Pool Stats Response
 */
interface AlexPoolStats {
  pool_token_id: number;
  base_token: string;
  quote_token: string;
  base_symbol?: string;
  quote_symbol?: string;
  tvl?: number;
  volume_24h?: number;
  volume_7d?: number;
  fees_24h?: number;
  apr?: number;
  liquidity?: number;
}

/**
 * ALEX Protocol Integration
 * Fetches sBTC staking and yield farming data from ALEX Protocol API
 */
export class AlexProtocolIntegration {
  private contractAddress: string;
  private contractName: string;

  constructor() {
    const contractId =
      config.protocols.alex || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-pool-v2-01';
    const [address, name] = contractId.split('.');
    this.contractAddress = address;
    this.contractName = name;

    logger.info('ALEX Protocol integration initialized', {
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      apiBase: ALEX_API_BASE,
    });
  }

  /**
   * Fetch all sBTC yield opportunities from ALEX API
   */
  async fetchYieldOpportunities(): Promise<YieldOpportunity[]> {
    try {
      logger.info('Fetching ALEX yield opportunities from API');

      // Get all swap pairs
      const allPairs = await this.fetchAllSwapPairs();

      // Filter for sBTC pairs
      const sbtcPairs = allPairs.filter(
        pair =>
          pair.base?.toLowerCase().includes('sbtc') ||
          pair.quote?.toLowerCase().includes('sbtc') ||
          pair.baseSymbol?.toLowerCase().includes('sbtc') ||
          pair.quoteSymbol?.toLowerCase().includes('sbtc')
      );

      logger.debug('Found sBTC pairs', { count: sbtcPairs.length });

      const opportunities: YieldOpportunity[] = [];

      // Fetch detailed stats for each sBTC pair
      for (const pair of sbtcPairs) {
        try {
          const poolStats = await this.fetchPoolStats(pair.id);
          const opportunity = await this.transformToYieldOpportunity(pair, poolStats);

          if (opportunity) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          logger.error(`Failed to process pool ${pair.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(`Fetched ${opportunities.length} ALEX yield opportunities`);
      return opportunities;
    } catch (error) {
      logger.error('Failed to fetch ALEX opportunities', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch all swap pairs from ALEX API
   */
  private async fetchAllSwapPairs(): Promise<AlexSwapPair[]> {
    const url = `${ALEX_API_BASE}/v1/allswaps`;

    try {
      logger.debug('Fetching all swap pairs from ALEX API');

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AlexSwapPair[];
      logger.debug('Fetched swap pairs', { count: data.length });

      return data;
    } catch (error) {
      logger.error('Failed to fetch swap pairs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Fetch pool statistics for a specific pool
   */
  private async fetchPoolStats(poolTokenId: number): Promise<AlexPoolStats | null> {
    const url = `${ALEX_API_BASE}/v1/pool_stats/${poolTokenId}?limit=1`;

    try {
      logger.debug('Fetching pool stats from ALEX API', { poolTokenId });

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn(`Pool stats not available for ${poolTokenId}`);
        return null;
      }

      const data = (await response.json()) as AlexPoolStats[];

      if (data.length === 0) {
        return null;
      }

      logger.debug('Fetched pool stats successfully', { poolTokenId });
      return data[0];
    } catch (error) {
      logger.error('Failed to fetch pool stats', {
        poolTokenId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch pool TVL from liquidity endpoint
   */
  private async fetchPoolTVL(poolTokenId: number): Promise<number | null> {
    const url = `${ALEX_API_BASE}/v1/pool_liquidity/${poolTokenId}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        token: number;
        liquidity_value?: Array<{ block_height: number; liquidity: number }>;
      };

      // Get the latest liquidity value from the array
      if (data.liquidity_value && data.liquidity_value.length > 0) {
        const latestLiquidity = data.liquidity_value[data.liquidity_value.length - 1];
        logger.debug('Fetched pool liquidity', {
          poolTokenId,
          liquidity: latestLiquidity.liquidity
        });
        return latestLiquidity.liquidity;
      }

      return null;
    } catch (error) {
      logger.debug('Failed to fetch pool TVL', { poolTokenId });
      return null;
    }
  }

  /**
   * Fetch pool volume
   */
  private async fetchPoolVolume(poolTokenId: number): Promise<{ volume24h: number; volume7d: number } | null> {
    try {
      const [volume24hResponse, volume7dResponse] = await Promise.all([
        fetch(`${ALEX_API_BASE}/v1/pool_volume/${poolTokenId}`, {
          headers: { Accept: 'application/json' },
        }),
        fetch(`${ALEX_API_BASE}/v1/volume_7d/${poolTokenId}`, {
          headers: { Accept: 'application/json' },
        }),
      ]);

      const volume24h = volume24hResponse.ok
        ? parseFloat(((await volume24hResponse.json()) as { volume?: string }).volume || '0')
        : 0;

      const volume7d = volume7dResponse.ok
        ? parseFloat(((await volume7dResponse.json()) as { volume?: string }).volume || '0')
        : 0;

      return { volume24h, volume7d };
    } catch (error) {
      logger.debug('Failed to fetch pool volume', { poolTokenId });
      return null;
    }
  }

  /**
   * Transform ALEX pool data to standardized YieldOpportunity
   */
  private async transformToYieldOpportunity(
    pair: AlexSwapPair,
    poolStats: AlexPoolStats | null
  ): Promise<YieldOpportunity | null> {
    try {
      // Get BTC price for calculations
      const btcPrice = await priceOracle.getBitcoinPrice();

      // Determine which token is sBTC
      const isSbtcBase = pair.baseSymbol?.toLowerCase().includes('sbtc') ||
                         pair.base?.toLowerCase().includes('sbtc');

      const sbtcSymbol = 'sBTC';
      const otherSymbol = isSbtcBase ? pair.quoteSymbol || 'Unknown' : pair.baseSymbol || 'Unknown';

      // Get TVL (from stats or fetch separately)
      let tvl = poolStats?.tvl || poolStats?.liquidity || 0;
      if (!tvl || tvl === 0) {
        const fetchedTVL = await this.fetchPoolTVL(pair.id);
        tvl = fetchedTVL || 0;
      }

      // Skip pools with zero TVL - they are not useful opportunities
      if (!tvl || tvl === 0) {
        logger.debug(`Skipping pool ${pair.id} - zero TVL`, {
          poolId: pair.id,
          poolName: `${pair.baseSymbol}-${pair.quoteSymbol}`,
        });
        return null;
      }

      // Get volume from pair data
      let volume24h = poolStats?.volume_24h || 0;

      if (!volume24h && pair.baseVolume && pair.quoteVolume) {
        // Calculate volume from base and quote volumes
        volume24h = (pair.baseVolume || 0) + (pair.quoteVolume || 0);
      }

      if (!volume24h) {
        const volumeData = await this.fetchPoolVolume(pair.id);
        volume24h = volumeData?.volume24h || 0;
      }

      // Calculate fees (ALEX charges 0.3% trading fee)
      const fees24h = volume24h * 0.003;

      // Calculate trading fee APY
      const tradingFeeApy = this.calculateTradingFeeAPY(fees24h, tvl);

      // Get reward APY from stats or estimate
      const rewardApy = poolStats?.apr || this.estimateRewardAPY(tvl);

      // Total APY
      const totalApy = tradingFeeApy + rewardApy;

      // Pool name
      const poolName = `${sbtcSymbol}-${otherSymbol} LP`;

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(tvl, otherSymbol, volume24h);

      // Determine protocol type
      const protocolType = this.getProtocolType(poolName);

      return {
        protocol: Protocol.ALEX,
        protocolType,
        poolId: pair.id.toString(),
        poolName,

        apy: totalApy,
        apyBreakdown: {
          base: tradingFeeApy,
          rewards: rewardApy,
          fees: tradingFeeApy,
        },

        tvl,
        tvlInSBTC: tvl / btcPrice / 2, // Estimate sBTC amount (half of pool)
        volume24h,

        riskLevel,
        riskFactors: this.identifyRiskFactors(tvl, otherSymbol, volume24h, totalApy),

        minDeposit: 5000000, // 0.05 sBTC in sats
        lockPeriod: 0, // No lock for ALEX pools

        depositFee: 0,
        withdrawalFee: 0,
        performanceFee: 0,

        impermanentLossRisk: true, // LP positions have IL risk
        auditStatus: 'audited',
        protocolAge: 365, // ALEX launched ~1 year ago (Jan 2024)

        contractAddress: `${this.contractAddress}.${this.contractName}`,
        description: `Provide ${poolName} liquidity on ALEX to earn ${totalApy.toFixed(2)}% APY from trading fees (${tradingFeeApy.toFixed(2)}%) and ALEX rewards (${rewardApy.toFixed(2)}%). ALEX is a full-service Bitcoin DeFi platform on Stacks.`,
        updatedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to transform pool data', {
        poolId: pair.id,
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
    // ALEX provides ALEX token rewards
    // Higher TVL pools typically have lower reward APY
    if (tvl > 15000000) return 10; // > $15M
    if (tvl > 10000000) return 15; // > $10M
    if (tvl > 5000000) return 20; // > $5M
    if (tvl > 2000000) return 25; // > $2M
    return 30; // Small pools get higher rewards
  }

  /**
   * Get protocol type based on pool name
   */
  private getProtocolType(poolName: string): ProtocolType {
    if (poolName.includes('auto') || poolName.includes('Auto')) {
      return ProtocolType.AUTO_COMPOUNDING;
    }
    if (poolName.includes('farm') || poolName.includes('Farm')) {
      return ProtocolType.YIELD_FARMING;
    }
    return ProtocolType.LIQUIDITY_POOL;
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    tvl: number,
    otherTokenSymbol: string,
    volume24h: number
  ): RiskLevel {
    // Volatile pairs = higher risk
    if (otherTokenSymbol === 'STX' || otherTokenSymbol === 'ALEX') {
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
    if (otherTokenSymbol === 'USDA' || otherTokenSymbol === 'USDC') {
      return RiskLevel.MEDIUM; // Still have some IL risk
    }

    return RiskLevel.MEDIUM; // Default for LP positions
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(
    tvl: number,
    otherTokenSymbol: string,
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
    if (otherTokenSymbol === 'STX' || otherTokenSymbol === 'ALEX') {
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

    // ALEX token price risk
    risks.push('Rewards paid in ALEX tokens - subject to ALEX token price volatility');

    // Smart contract risk
    risks.push('Smart contract risk - always DYOR and only invest what you can afford to lose');

    return risks;
  }
}

// Export singleton instance
export const alexProtocol = new AlexProtocolIntegration();
export default alexProtocol;
