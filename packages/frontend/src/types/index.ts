// Type definitions for BitYield Frontend

// Yield Opportunity (flexible for both backend and live contract data)
export interface YieldOpportunity {
  id: string;
  protocol: string;
  protocolType?: 'lending' | 'liquidity_pool' | 'staking' | 'yield_farming' | 'auto_compounding';
  poolId?: string;
  poolName: string;
  apy: number;
  apyBreakdown?: {
    base: number;
    rewards?: number;
    fees?: number;
  };
  tvl: number;
  tvlInSBTC?: number;
  volume24h?: number;
  fees24h?: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors?: string[];
  minDeposit: number;
  lockPeriod: number;
  depositFee?: number;
  withdrawalFee?: number;
  performanceFee?: number;
  impermanentLossRisk: boolean;
  auditStatus?: 'audited' | 'unaudited' | 'in-progress';
  protocolAge?: number;
  contractAddress: string;
  description: string;
  updatedAt?: number;
  lastUpdated?: Date;
  tags?: string[];
  isLive?: boolean;
}

// AI Recommendation from backend
export interface Recommendation {
  recommended: {
    protocol: string;
    pool: string;
    expectedApy: number;
  };
  reasoning: string;
  alternatives: Array<{
    protocol: string;
    pool: string;
    apy: number;
    pros: string[];
    cons: string[];
  }>;
  riskAssessment: string;
  projectedEarnings: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  confidence: number;
}

// User Preferences for recommendation
export interface UserPreferences {
  amount: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  lockPeriodPreference?: number;
  avoidImpermanentLoss?: boolean;
}

// Wallet State
export interface WalletState {
  isConnected: boolean;
  address: string | null;
  stxBalance: number;
  sbtcBalance: number;
  network: 'testnet' | 'mainnet';
}

// Vault Balance
export interface VaultBalance {
  userBalance: number;
  totalTvl: number;
  depositorCount: number;
  depositTimestamp?: number;
  withdrawalTimestamp?: number;
}

// Transaction Status
export interface Transaction {
  txId: string;
  status: 'pending' | 'success' | 'failed';
  type: 'deposit' | 'withdrawal';
  amount: number;
  timestamp: number;
}

// Historical Yield Data for charts
export interface HistoricalYield {
  date: string;
  zest: number;
  velar: number;
  alex: number;
}

// Market Context Data
export interface MarketContext {
  btcPrice: number;
  btcChange24h: number;
  stacksBlockHeight: number;
  ecosystemTvl: number;
}
