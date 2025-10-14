/**
 * Protocol-specific type definitions
 */

/**
 * Zest Protocol - Lending Platform
 */
export interface ZestLendingPool {
  poolId: string;
  poolName: string;
  contractAddress: string;

  // Lending metrics
  supplyApy: number;
  borrowApy: number;
  utilization: number; // Percentage

  // Liquidity
  totalSupply: number; // In sats
  totalBorrowed: number; // In sats
  availableLiquidity: number; // In sats

  // Collateral
  collateralFactor: number; // Percentage
  liquidationThreshold: number; // Percentage

  // Risk
  badDebt: number; // In sats
  reserves: number; // Protocol reserves in sats
}

/**
 * Velar DEX - Liquidity Pools
 */
export interface VelarLiquidityPool {
  poolId: string;
  poolName: string;
  contractAddress: string;

  // Trading pairs
  token0: string; // e.g., "sBTC"
  token1: string; // e.g., "STX"

  // Liquidity
  reserve0: number; // Token0 reserves
  reserve1: number; // Token1 reserves
  totalLiquidity: number; // USD value

  // Trading metrics
  volume24h: number; // USD
  volumeWeek: number; // USD
  fees24h: number; // USD

  // LP rewards
  tradingFeeApy: number; // APY from trading fees
  rewardApy: number; // APY from VELAR token rewards
  totalApy: number; // Combined APY

  // Risk
  impermanentLoss24h: number; // Percentage
  priceImpact: number; // For typical trade size
}

/**
 * ALEX Protocol - Yield Farming & Staking
 */
export interface AlexYieldFarm {
  farmId: string;
  farmName: string;
  contractAddress: string;

  // Farm type
  type: 'staking' | 'lp_farming' | 'auto_vault';

  // Staking info
  stakingToken: string; // e.g., "sBTC"
  rewardToken: string; // e.g., "ALEX"

  // Yields
  baseApy: number; // Base staking/LP APY
  rewardApy: number; // ALEX token reward APY
  boostedApy: number; // Maximum boosted APY
  totalApy: number; // Combined APY

  // Liquidity
  totalStaked: number; // In staking token units
  totalStakedUsd: number; // USD value

  // Rewards
  dailyRewards: number; // Reward tokens per day
  rewardTokenPrice: number; // USD price of reward token

  // Auto-compound (if applicable)
  autoCompound: boolean;
  compoundFrequency: number; // Hours between compounds

  // Boost
  boostMultiplier: number; // Maximum boost available
  boostRequirement: number; // ALEX tokens needed for max boost
}

/**
 * On-chain smart contract call parameters
 */
export interface ContractCallParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: any[];
  senderAddress: string;
}

/**
 * Stacks API response for contract calls
 */
export interface StacksReadOnlyResponse {
  okay: boolean;
  result: string; // Hex-encoded Clarity value
}

/**
 * Price oracle data
 */
export interface PriceData {
  symbol: string; // e.g., "BTC", "STX", "ALEX"
  priceUsd: number;
  priceChange24h: number; // Percentage
  volume24h: number;
  lastUpdated: number; // Unix timestamp
  source: string; // e.g., "coingecko", "on-chain"
}

/**
 * Protocol metadata
 */
export interface ProtocolMetadata {
  name: string;
  website: string;
  docs: string;
  audit: {
    audited: boolean;
    auditor?: string;
    reportUrl?: string;
    date?: string;
  };
  tvl: number; // Total TVL across all pools
  age: number; // Days since launch
  governance: {
    hasGovernance: boolean;
    governanceToken?: string;
  };
}
