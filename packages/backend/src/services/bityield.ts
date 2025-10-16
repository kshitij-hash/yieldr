/**
 * BitYield Service
 *
 * Handles all interactions with BitYield smart contracts on Stacks blockchain:
 * - Pool Oracle: APY data for ALEX and Velar pools
 * - Vault (Yielder): User deposits, withdrawals, and rebalancing
 * - Simulated Pools: ALEX and Velar pool data
 */

import { config } from '../config/env.js';
import { createLogger } from '../config/logger.js';

const logger = createLogger('bityield');

// Stacks.js imports for contract interactions
import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  principalCV,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from '@stacks/network';

// Types
interface PoolAPYData {
  alexApy: number; // in basis points (100 = 1%)
  velarApy: number; // in basis points
  alexTvl: number; // in satoshis
  velarTvl: number; // in satoshis
  lastUpdated: number; // block height
}

interface UserBalance {
  vaultBalance: number; // in satoshis
  alexAllocation: number;
  velarAllocation: number;
  totalValueWithYield: number;
  riskPreference: number; // 1=conservative, 2=moderate, 3=aggressive
}

interface VaultStats {
  totalTvl: number; // in satoshis
  depositorCount: number;
  isPaused: boolean;
}

interface PoolStats {
  name: 'alex' | 'velar';
  tvl: number;
  apy: number;
  isPaused: boolean;
}

/**
 * BitYield Service Class
 */
export class BitYieldService {
  private network: StacksNetwork;
  private deployerAddress: string;
  private vaultContract: string;
  private poolOracleContract: string;
  private alexPoolContract: string;
  private velarPoolContract: string;

  constructor() {
    // Initialize network
    this.network =
      config.stacks.network === 'mainnet'
        ? STACKS_MAINNET
        : STACKS_TESTNET;

    // Get contract addresses from config
    this.deployerAddress = config.bityield.deployerAddress || '';
    this.vaultContract = config.bityield.vault || '';
    this.poolOracleContract = config.bityield.poolOracle || '';
    this.alexPoolContract = config.bityield.alexPool || '';
    this.velarPoolContract = config.bityield.velarPool || '';

    logger.info('BitYield Service initialized', {
      network: config.stacks.network,
      deployer: this.deployerAddress,
      vault: this.vaultContract,
    });
  }

  // ============================================================================
  // POOL ORACLE METHODS
  // ============================================================================

  /**
   * Get APY data for both pools from the oracle
   */
  async getPoolAPYs(): Promise<PoolAPYData> {
    try {
      const [contractAddress, contractName] = this.poolOracleContract.split('.');

      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-all-data',
        functionArgs: [],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      // Parse Clarity response
      const jsonResult = cvToJSON(result);

      if (jsonResult.success || jsonResult.type === 'ok') {
        const data = jsonResult.value.value;
        return {
          alexApy: parseInt(data['alex-apy'].value),
          velarApy: parseInt(data['velar-apy'].value),
          alexTvl: parseInt(data['alex-tvl'].value),
          velarTvl: parseInt(data['velar-tvl'].value),
          lastUpdated: Math.max(parseInt(data['alex-updated'].value), parseInt(data['velar-updated'].value)),
        };
      }

      throw new Error('Failed to fetch APY and TVL data from oracle');
    } catch (error) {
      logger.error('Error fetching pool APYs', { error });
      throw error;
    }
  }

  /**
   * Get ALEX APY only
   */
  async getAlexAPY(): Promise<number> {
    try {
      const [contractAddress, contractName] = this.poolOracleContract.split('.');

      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-alex-apy',
        functionArgs: [],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      const jsonResult = cvToJSON(result);
      if (jsonResult.success || jsonResult.type === 'ok') {
        return parseInt(jsonResult.value.value);
      }

      throw new Error('Failed to fetch ALEX APY');
    } catch (error) {
      logger.error('Error fetching ALEX APY', { error });
      throw error;
    }
  }

  /**
   * Get Velar APY only
   */
  async getVelarAPY(): Promise<number> {
    try {
      const [contractAddress, contractName] = this.poolOracleContract.split('.');

      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-velar-apy',
        functionArgs: [],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      const jsonResult = cvToJSON(result);
      if (jsonResult.success || jsonResult.type === 'ok') {
        return parseInt(jsonResult.value.value);
      }

      throw new Error('Failed to fetch Velar APY');
    } catch (error) {
      logger.error('Error fetching Velar APY', { error });
      throw error;
    }
  }

  // ============================================================================
  // VAULT METHODS
  // ============================================================================

  /**
   * Get vault statistics (TVL, depositor count, pause status)
   */
  async getVaultStats(): Promise<VaultStats> {
    try {
      const [contractAddress, contractName] = this.vaultContract.split('.');

      // Call multiple read-only functions in parallel
      const [tvlResult, depositorCountResult, isPausedResult] = await Promise.all([
        fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-total-tvl',
          functionArgs: [],
          network: this.network,
          senderAddress: this.deployerAddress,
        }),
        fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-depositor-count',
          functionArgs: [],
          network: this.network,
          senderAddress: this.deployerAddress,
        }),
        fetchCallReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'is-paused',
          functionArgs: [],
          network: this.network,
          senderAddress: this.deployerAddress,
        }),
      ]);

      const tvlJson = cvToJSON(tvlResult);
      const depositorJson = cvToJSON(depositorCountResult);
      const pausedJson = cvToJSON(isPausedResult);

      return {
        totalTvl: parseInt(tvlJson.value?.value || tvlJson.value),
        depositorCount: parseInt(depositorJson.value?.value || depositorJson.value),
        isPaused: pausedJson.value?.value === true || pausedJson.value === true,
      };
    } catch (error) {
      logger.error('Error fetching vault stats', { error });
      throw error;
    }
  }

  /**
   * Get user's balance and positions in the vault
   */
  async getUserBalance(userAddress: string): Promise<UserBalance> {
    try {
      const [contractAddress, contractName] = this.vaultContract.split('.');
      const userPrincipal = principalCV(userAddress);

      // Call multiple read-only functions in parallel
      const [balanceResult, allocationsResult, totalValueResult, riskResult] =
        await Promise.all([
          fetchCallReadOnlyFunction({
            contractAddress,
            contractName,
            functionName: 'get-balance',
            functionArgs: [userPrincipal],
            network: this.network,
            senderAddress: this.deployerAddress,
          }),
          fetchCallReadOnlyFunction({
            contractAddress,
            contractName,
            functionName: 'get-pool-allocations',
            functionArgs: [userPrincipal],
            network: this.network,
            senderAddress: this.deployerAddress,
          }),
          fetchCallReadOnlyFunction({
            contractAddress,
            contractName,
            functionName: 'get-total-value-with-yield',
            functionArgs: [userPrincipal],
            network: this.network,
            senderAddress: this.deployerAddress,
          }),
          fetchCallReadOnlyFunction({
            contractAddress,
            contractName,
            functionName: 'get-risk-preference',
            functionArgs: [userPrincipal],
            network: this.network,
            senderAddress: this.deployerAddress,
          }),
        ]);

      const balance = parseInt(cvToJSON(balanceResult).value);
      const allocations = cvToJSON(allocationsResult);
      const totalValue = parseInt(cvToJSON(totalValueResult).value.value);
      const risk = parseInt(cvToJSON(riskResult).value.value);

      return {
        vaultBalance: balance,
        alexAllocation: parseInt(allocations.value.value['alex-amount'].value),
        velarAllocation: parseInt(allocations.value.value['velar-amount'].value),
        totalValueWithYield: totalValue,
        riskPreference: risk,
      };
    } catch (error) {
      logger.error('Error fetching user balance', { error, userAddress });
      throw error;
    }
  }

  /**
   * Get user's deposit timestamp
   */
  async getUserDepositTimestamp(userAddress: string): Promise<number> {
    try {
      const [contractAddress, contractName] = this.vaultContract.split('.');
      const userPrincipal = principalCV(userAddress);

      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-deposit-timestamp',
        functionArgs: [userPrincipal],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      const jsonResult = cvToJSON(result);
      return parseInt(jsonResult.value?.value || jsonResult.value);
    } catch (error) {
      logger.error('Error fetching deposit timestamp', { error, userAddress });
      throw error;
    }
  }

  /**
   * Get user's withdrawal timestamp
   */
  async getUserWithdrawalTimestamp(userAddress: string): Promise<number> {
    try {
      const [contractAddress, contractName] = this.vaultContract.split('.');
      const userPrincipal = principalCV(userAddress);

      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-withdrawal-timestamp',
        functionArgs: [userPrincipal],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      const jsonResult = cvToJSON(result);
      return parseInt(jsonResult.value?.value || jsonResult.value);
    } catch (error) {
      logger.error('Error fetching withdrawal timestamp', { error, userAddress });
      throw error;
    }
  }

  // ============================================================================
  // POOL METHODS
  // ============================================================================

  /**
   * Get statistics for a specific pool (ALEX or Velar)
   * TVL and APY are fetched from pool oracle (mainnet data simulation)
   */
  async getPoolStats(poolName: 'alex' | 'velar'): Promise<PoolStats> {
    try {
      const contractAddress =
        poolName === 'alex' ? this.alexPoolContract : this.velarPoolContract;
      const [address, name] = contractAddress.split('.');

      // Get paused status from the simulated pool contract
      const isPausedResult = await fetchCallReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'is-paused',
        functionArgs: [],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      // Get APY and TVL from oracle (mainnet data)
      const oracleData = await this.getPoolAPYs();

      const pausedJson = cvToJSON(isPausedResult);

      return {
        name: poolName,
        tvl: poolName === 'alex' ? oracleData.alexTvl : oracleData.velarTvl,
        apy: poolName === 'alex' ? oracleData.alexApy : oracleData.velarApy,
        isPaused: pausedJson.value?.value === true || pausedJson.value === true,
      };
    } catch (error) {
      logger.error('Error fetching pool stats', { error, poolName });
      throw error;
    }
  }

  /**
   * Get user's balance in a specific pool
   */
  async getUserPoolBalance(poolName: 'alex' | 'velar', userAddress: string): Promise<number> {
    try {
      const contractAddress =
        poolName === 'alex' ? this.alexPoolContract : this.velarPoolContract;
      const [address, name] = contractAddress.split('.');
      const userPrincipal = principalCV(userAddress);

      const result = await fetchCallReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'get-balance',
        functionArgs: [userPrincipal],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      const jsonResult = cvToJSON(result);
      return parseInt(jsonResult.value?.value || jsonResult.value);
    } catch (error) {
      logger.error('Error fetching user pool balance', { error, poolName, userAddress });
      throw error;
    }
  }

  /**
   * Get user's accrued yield in a specific pool
   */
  async getUserPoolYield(poolName: 'alex' | 'velar', userAddress: string): Promise<number> {
    try {
      const contractAddress =
        poolName === 'alex' ? this.alexPoolContract : this.velarPoolContract;
      const [address, name] = contractAddress.split('.');
      const userPrincipal = principalCV(userAddress);

      const result = await fetchCallReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'get-accrued-yield',
        functionArgs: [userPrincipal],
        network: this.network,
        senderAddress: this.deployerAddress,
      });

      const jsonResult = cvToJSON(result);
      return parseInt(jsonResult.value?.value || jsonResult.value);
    } catch (error) {
      logger.error('Error fetching user pool yield', { error, poolName, userAddress });
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert basis points to percentage
   * @param basisPoints - APY in basis points (100 = 1%)
   * @returns APY as percentage (e.g., 5.0 for 5%)
   */
  basisPointsToPercent(basisPoints: number): number {
    return basisPoints / 100;
  }

  /**
   * Convert satoshis to BTC
   * @param satoshis - Amount in satoshis
   * @returns Amount in BTC
   */
  satsToBTC(satoshis: number): number {
    return satoshis / 100000000;
  }

  /**
   * Format APY for display
   * @param basisPoints - APY in basis points
   * @returns Formatted APY string (e.g., "5.00%")
   */
  formatAPY(basisPoints: number): string {
    return `${this.basisPointsToPercent(basisPoints).toFixed(2)}%`;
  }

  /**
   * Format BTC amount for display
   * @param satoshis - Amount in satoshis
   * @returns Formatted BTC string (e.g., "1.23456789 BTC")
   */
  formatBTC(satoshis: number): string {
    return `${this.satsToBTC(satoshis).toFixed(8)} BTC`;
  }

  /**
   * Get risk preference name
   * @param risk - Risk preference value (1, 2, or 3)
   * @returns Risk name
   */
  getRiskName(risk: number): string {
    switch (risk) {
      case 1:
        return 'Conservative';
      case 2:
        return 'Moderate';
      case 3:
        return 'Aggressive';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.deployerAddress &&
      this.vaultContract &&
      this.poolOracleContract &&
      this.alexPoolContract &&
      this.velarPoolContract
    );
  }
}

// Export singleton instance
export const bityieldService = new BitYieldService();
