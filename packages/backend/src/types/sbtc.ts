/**
 * sBTC-specific types and interfaces for real data integration
 * Based on actual API responses from Velar, ALEX, and other protocols
 */

import { z } from 'zod';

// ============================================================================
// VELAR sBTC TYPES (Based on real API response)
// ============================================================================

/**
 * Real Velar API response structure for sBTC pools
 * Based on: https://api.velar.co/pools/SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token/SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx
 */
export interface VelarSBTCPoolResponse {
  symbol: string;                           // "STX-sBTC"
  token0Symbol: string;                     // "STX"
  token0ContractAddress: string;            // "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx"
  token1Symbol: string;                     // "sBTC"
  token1ContractAddress: string;            // "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
  lpTokenContractAddress: string;           // LP token contract
  stats: {
    apy: number;                           // Real APY: 12.43131598334191
    totalSupply: number;                   // Total LP tokens
    totalStaked: number;                   // Staked LP tokens
    reserve0: number;                      // STX reserves: 388177625562
    reserve1: number;                      // sBTC reserves: 163266241
    volume_usd: {
      value: number;                       // 24h volume: 4710.94622685989
    };
    tvl_usd: {
      value: number;                       // Total TVL: 366780.96124216984
      [tokenAddress: string]: number;      // Per-token TVL breakdown
    };
    fees_usd: {
      value: number;                       // 24h fees: 10.610700681467112
    };
  };
}

/**
 * Processed sBTC pool data for internal use
 */
export interface SBTCPoolData {
  // Pool identification
  poolId: string;                          // "sbtc-stx-velar"
  poolName: string;                        // "sBTC-STX Liquidity Pool"
  protocol: 'velar' | 'alex' | 'zest';
  protocolType: 'liquidity_pool' | 'lending' | 'staking';
  
  // sBTC-specific data
  sbtcReserve: number;                     // sBTC amount in pool
  pairedTokenReserve: number;              // Paired token amount (STX/USDA)
  pairedTokenSymbol: string;               // "STX" | "USDA"
  
  // Yield data
  apy: number;                             // Total APY
  apyBreakdown: {
    tradingFees: number;                   // APY from trading fees
    rewards?: number;                      // APY from token rewards
    base?: number;                         // Base lending/staking APY
  };
  
  // Financial metrics
  tvlUsd: number;                          // Total value locked in USD
  tvlSbtc: number;                         // sBTC portion of TVL
  volume24hUsd: number;                    // 24h trading volume
  fees24hUsd: number;                      // 24h fees generated
  
  // Risk metrics
  impermanentLossRisk: boolean;            // True for LP pools
  estimatedIL24h: number;                  // Estimated IL over 24h
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];                   // Risk warnings
  
  // Pool mechanics
  minDeposit: number;                      // Minimum sBTC deposit (in sats)
  lockPeriod: number;                      // Lock period in days (0 = flexible)
  depositFee: number;                      // Deposit fee percentage
  withdrawalFee: number;                   // Withdrawal fee percentage
  
  // Metadata
  contractAddress: string;                 // Pool contract address
  auditStatus: 'audited' | 'unaudited' | 'pending';
  lastUpdated: number;                     // Timestamp of last data update
}

// ============================================================================
// ALEX sBTC TYPES (For future implementation)
// ============================================================================

/**
 * ALEX protocol sBTC opportunities (via contract calls)
 */
export interface AlexSBTCFarm {
  farmId: string;                          // Farm identifier
  farmName: string;                        // "sBTC Staking Farm"
  contractAddress: string;                 // Farm contract address
  
  // Staking data
  sbtcStaked: number;                      // Total sBTC staked
  baseApy: number;                         // Base staking APY
  rewardApy: number;                       // ALEX token reward APY
  totalApy: number;                        // Combined APY
  
  // Farm mechanics
  lockPeriod: number;                      // Lock period in days
  rewardToken: string;                     // "ALEX"
  autoCompound: boolean;                   // Auto-compound available
  
  // Risk data
  riskLevel: 'low' | 'medium' | 'high';
  tvlUsd: number;                          // Total value locked
}

// ============================================================================
// UNIFIED sBTC OPPORTUNITY TYPE
// ============================================================================

/**
 * Unified interface for all sBTC yield opportunities
 * Standardizes data from different protocols
 */
export interface SBTCOpportunity {
  // Identification
  id: string;                              // Unique identifier
  protocol: 'velar' | 'alex' | 'zest';
  type: 'liquidity_pool' | 'lending' | 'staking' | 'farming';
  name: string;                            // Human-readable name
  
  // Core metrics
  apy: number;                             // Total APY
  tvlUsd: number;                          // Total value locked
  sbtcAmount: number;                      // sBTC in opportunity
  
  // Risk assessment
  riskScore: number;                       // 1-10 risk score
  riskLevel: 'low' | 'medium' | 'high';
  impermanentLossRisk: boolean;
  
  // User requirements
  minDeposit: number;                      // Minimum sBTC (sats)
  lockPeriod: number;                      // Days (0 = flexible)
  
  // Fees
  fees: {
    deposit: number;                       // Deposit fee %
    withdrawal: number;                    // Withdrawal fee %
    performance: number;                   // Performance fee %
  };
  
  // Additional data
  description: string;                     // User-friendly description
  contractAddress: string;                 // Smart contract address
  lastUpdated: number;                     // Data freshness timestamp
}

// ============================================================================
// API RESPONSE SCHEMAS (Zod validation)
// ============================================================================

/**
 * Zod schema for Velar API response validation
 */
export const VelarSBTCPoolSchema = z.object({
  symbol: z.string(),
  token0Symbol: z.string(),
  token0ContractAddress: z.string(),
  token1Symbol: z.string(),
  token1ContractAddress: z.string(),
  lpTokenContractAddress: z.string(),
  stats: z.object({
    apy: z.number(),
    totalSupply: z.number(),
    totalStaked: z.number(),
    reserve0: z.number(),
    reserve1: z.number(),
    volume_usd: z.object({
      value: z.number(),
    }),
    tvl_usd: z.object({
      value: z.number(),
    }).and(z.record(z.string(), z.number())),
    fees_usd: z.object({
      value: z.number(),
    }),
  }),
});

/**
 * Zod schema for processed sBTC opportunity
 */
export const SBTCOpportunitySchema = z.object({
  id: z.string(),
  protocol: z.enum(['velar', 'alex', 'zest']),
  type: z.enum(['liquidity_pool', 'lending', 'staking', 'farming']),
  name: z.string(),
  apy: z.number().min(0).max(1000), // 0-1000% APY range
  tvlUsd: z.number().min(0),
  sbtcAmount: z.number().min(0),
  riskScore: z.number().min(1).max(10),
  riskLevel: z.enum(['low', 'medium', 'high']),
  impermanentLossRisk: z.boolean(),
  minDeposit: z.number().min(0),
  lockPeriod: z.number().min(0),
  fees: z.object({
    deposit: z.number().min(0).max(100),
    withdrawal: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
  }),
  description: z.string(),
  contractAddress: z.string(),
  lastUpdated: z.number(),
});

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * sBTC token contract addresses
 */
export const SBTC_CONTRACTS = {
  MAINNET: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
  TESTNET: 'ST1R1061ZT6KPJXQ7PAXPFB6ZAZ6ZWW28GBQA1W0F.sbtc-token', // Example testnet
} as const;

/**
 * Known sBTC pool pairs on Velar
 */
export const VELAR_SBTC_POOLS = {
  'STX-sBTC': {
    token0: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx',
    token1: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    riskLevel: 'high' as const, // Volatile pair
  },
  // Add more pairs as discovered
} as const;

/**
 * sBTC decimal places (8 decimals like Bitcoin)
 */
export const SBTC_DECIMALS = 8;
export const SBTC_UNIT = 100_000_000; // 1 sBTC = 100,000,000 sats

/**
 * Risk thresholds for sBTC opportunities
 */
export const SBTC_RISK_THRESHOLDS = {
  MIN_TVL_USD: 100_000,        // Minimum $100k TVL for safety
  MAX_APY_WARNING: 50,         // Warn if APY > 50%
  MAX_IL_WARNING: 10,          // Warn if IL > 10%
  MIN_VOLUME_24H: 1_000,       // Minimum $1k daily volume
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  VelarSBTCPoolResponse,
  SBTCPoolData,
  AlexSBTCFarm,
  SBTCOpportunity,
};
