/**
 * Oracle Sync Service
 *
 * Automatically syncs mainnet APY data to testnet pool-oracle contract.
 * Fetches real APY from ALEX and Velar protocols and updates the oracle.
 *
 * Features:
 * - Periodic sync every 10 minutes
 * - Only updates if APY changes significantly (>0.5% difference)
 * - Automatic retry on failure
 * - Comprehensive logging
 */

import { createLogger } from '../config/logger.js';
import { config } from '../config/env.js';
import { alexProtocol } from '../protocols/alex.js';
import { velarDEX } from '../protocols/velar.js';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
} from '@stacks/transactions';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';

const logger = createLogger('oracle-sync');

// Sync interval: 10 minutes
const SYNC_INTERVAL_MS = 10 * 60 * 1000;

// Minimum APY change to trigger update (0.5% = 50 basis points)
const MIN_APY_CHANGE_THRESHOLD = 50;

interface APYData {
  alexApy: number; // in basis points
  velarApy: number; // in basis points
  alexTvl: number; // in satoshis
  velarTvl: number; // in satoshis
}

interface SyncStats {
  lastSyncAttempt: number;
  lastSuccessfulSync: number;
  totalSyncs: number;
  failedSyncs: number;
  lastError?: string;
}

/**
 * Oracle Sync Service
 */
export class OracleSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastApyData: APYData | null = null;
  private stats: SyncStats = {
    lastSyncAttempt: 0,
    lastSuccessfulSync: 0,
    totalSyncs: 0,
    failedSyncs: 0,
  };

  constructor() {
    logger.info('Oracle Sync Service initialized');
  }

  /**
   * Start the oracle sync service
   */
  start(): void {
    if (this.syncInterval) {
      logger.warn('Oracle sync service already running');
      return;
    }

    logger.info('Starting oracle sync service', {
      interval: `${SYNC_INTERVAL_MS / 1000}s`,
      threshold: `${MIN_APY_CHANGE_THRESHOLD / 100}%`,
    });

    // Perform initial sync immediately
    this.performSync().catch(error => {
      logger.error('Initial sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Schedule periodic syncs
    this.syncInterval = setInterval(() => {
      this.performSync().catch(error => {
        logger.error('Scheduled sync failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, SYNC_INTERVAL_MS);

    logger.info('Oracle sync service started');
  }

  /**
   * Stop the oracle sync service
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Oracle sync service stopped');
    }
  }

  /**
   * Perform a single sync operation
   */
  private async performSync(): Promise<void> {
    if (this.isSyncing) {
      logger.debug('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    this.stats.lastSyncAttempt = Date.now();

    try {
      logger.info('Starting oracle sync');

      // Step 1: Fetch mainnet APY data
      const apyData = await this.fetchMainnetAPY();

      if (!apyData) {
        throw new Error('Failed to fetch mainnet APY data');
      }

      logger.info('Fetched mainnet APY and TVL', {
        alex: `${apyData.alexApy / 100}% APY, ${(apyData.alexTvl / 100000000).toFixed(4)} BTC TVL`,
        velar: `${apyData.velarApy / 100}% APY, ${(apyData.velarTvl / 100000000).toFixed(4)} BTC TVL`,
      });

      // Step 2: Check if update is needed
      const needsUpdate = this.shouldUpdate(apyData);

      if (!needsUpdate) {
        logger.info('APY change below threshold, skipping update', {
          threshold: `${MIN_APY_CHANGE_THRESHOLD / 100}%`,
        });
        this.stats.lastSuccessfulSync = Date.now();
        this.stats.totalSyncs++;
        return;
      }

      // Step 3: Update oracle contract
      await this.updateOracle(apyData);

      // Update stats
      this.lastApyData = apyData;
      this.stats.lastSuccessfulSync = Date.now();
      this.stats.totalSyncs++;
      delete this.stats.lastError;

      logger.info('Oracle sync completed successfully', {
        alex: `${apyData.alexApy / 100}% APY, ${(apyData.alexTvl / 100000000).toFixed(4)} BTC TVL`,
        velar: `${apyData.velarApy / 100}% APY, ${(apyData.velarTvl / 100000000).toFixed(4)} BTC TVL`,
      });
    } catch (error) {
      this.stats.failedSyncs++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);

      logger.error('Oracle sync failed', {
        error: this.stats.lastError,
        attempt: this.stats.totalSyncs + 1,
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch mainnet APY and TVL from ALEX and Velar protocols
   */
  private async fetchMainnetAPY(): Promise<APYData | null> {
    try {
      // Fetch opportunities from both protocols
      const [alexOpportunities, velarOpportunities] = await Promise.all([
        alexProtocol.fetchYieldOpportunities(),
        velarDEX.fetchYieldOpportunities(),
      ]);

      // Find sBTC-STX pools (most liquid pools)
      const alexPool = alexOpportunities.find(
        opp =>
          opp.poolName.includes('sBTC') &&
          opp.poolName.includes('STX') &&
          opp.tvl > 100 // Filter out dust pools
      );

      const velarPool = velarOpportunities.find(
        opp =>
          opp.poolName.includes('sBTC') ||
          (opp.poolName.includes('STX') && opp.tvl > 100)
      );

      if (!alexPool && !velarPool) {
        logger.warn('No suitable sBTC pools found');
        return null;
      }

      // Convert APY percentage to basis points (e.g., 52.72% -> 5272)
      const alexApy = alexPool ? Math.round(alexPool.apy * 100) : 0;
      const velarApy = velarPool ? Math.round(velarPool.apy * 100) : 0;

      // Convert TVL from USD to satoshis
      // TVL is in USD, need to convert to BTC then to satoshis
      // Using a rough approximation: assume 1 BTC = $60,000 for now
      // In production, you'd want to fetch real BTC price from an API
      const btcPriceUsd = 60000; // This should ideally come from a price oracle

      const alexTvlBtc = alexPool ? alexPool.tvl / btcPriceUsd : 0;
      const velarTvlBtc = velarPool ? velarPool.tvl / btcPriceUsd : 0;

      // Convert BTC to satoshis (1 BTC = 100,000,000 sats)
      const alexTvl = Math.round(alexTvlBtc * 100000000);
      const velarTvl = Math.round(velarTvlBtc * 100000000);

      logger.info('Fetched mainnet data', {
        alex: {
          apy: `${alexApy / 100}%`,
          tvlUsd: alexPool?.tvl || 0,
          tvlBtc: alexTvlBtc.toFixed(4),
          tvlSats: alexTvl,
        },
        velar: {
          apy: `${velarApy / 100}%`,
          tvlUsd: velarPool?.tvl || 0,
          tvlBtc: velarTvlBtc.toFixed(4),
          tvlSats: velarTvl,
        },
      });

      return {
        alexApy,
        velarApy,
        alexTvl,
        velarTvl,
      };
    } catch (error) {
      logger.error('Failed to fetch mainnet APY and TVL', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if oracle should be updated based on APY change threshold
   */
  private shouldUpdate(newApyData: APYData): boolean {
    if (!this.lastApyData) {
      // First sync, always update
      return true;
    }

    const alexApyChange = Math.abs(newApyData.alexApy - this.lastApyData.alexApy);
    const velarApyChange = Math.abs(newApyData.velarApy - this.lastApyData.velarApy);

    // Also check for significant TVL changes (>5% change)
    const alexTvlChange = this.lastApyData.alexTvl > 0
      ? Math.abs((newApyData.alexTvl - this.lastApyData.alexTvl) / this.lastApyData.alexTvl * 10000) // in basis points
      : 10000; // First sync or zero TVL, always update

    const velarTvlChange = this.lastApyData.velarTvl > 0
      ? Math.abs((newApyData.velarTvl - this.lastApyData.velarTvl) / this.lastApyData.velarTvl * 10000) // in basis points
      : 10000;

    const MIN_TVL_CHANGE_THRESHOLD = 500; // 5% in basis points

    const shouldUpdate =
      alexApyChange >= MIN_APY_CHANGE_THRESHOLD ||
      velarApyChange >= MIN_APY_CHANGE_THRESHOLD ||
      alexTvlChange >= MIN_TVL_CHANGE_THRESHOLD ||
      velarTvlChange >= MIN_TVL_CHANGE_THRESHOLD;

    if (shouldUpdate) {
      logger.info('Data change detected', {
        alex: {
          apyOld: this.lastApyData.alexApy,
          apyNew: newApyData.alexApy,
          apyChange: alexApyChange,
          tvlOld: this.lastApyData.alexTvl,
          tvlNew: newApyData.alexTvl,
          tvlChangePercent: `${(alexTvlChange / 100).toFixed(2)}%`,
        },
        velar: {
          apyOld: this.lastApyData.velarApy,
          apyNew: newApyData.velarApy,
          apyChange: velarApyChange,
          tvlOld: this.lastApyData.velarTvl,
          tvlNew: newApyData.velarTvl,
          tvlChangePercent: `${(velarTvlChange / 100).toFixed(2)}%`,
        },
      });
    }

    return shouldUpdate;
  }

  /**
   * Update the oracle contract with new APY values
   */
  private async updateOracle(apyData: APYData): Promise<void> {
    const deployerAddress = config.bityield.deployerAddress;
    const oracleContract = config.bityield.poolOracle;

    if (!deployerAddress || !oracleContract) {
      throw new Error('Oracle contract address or deployer not configured');
    }

    // Check if private key is available
    const privateKeyOrMnemonic = process.env.DEPLOYER_PRIVATE_KEY || process.env.BITYIELD_DEPLOYER_PRIVATE_KEY;

    if (!privateKeyOrMnemonic) {
      logger.warn('No deployer private key configured, skipping contract update');
      logger.info('To enable automatic updates, set DEPLOYER_PRIVATE_KEY environment variable');

      // Still update lastApyData so we track changes
      this.lastApyData = apyData;
      return;
    }

    // Convert mnemonic to private key if needed
    let privateKey: string;
    if (privateKeyOrMnemonic.split(' ').length >= 12) {
      // It's a mnemonic phrase
      logger.debug('Converting mnemonic to private key');
      try {
        const wallet = await generateWallet({
          secretKey: privateKeyOrMnemonic,
          password: '',
        });
        privateKey = wallet.accounts[0].stxPrivateKey;
        logger.debug('Private key derived from mnemonic');
      } catch (error) {
        logger.error('Failed to derive private key from mnemonic', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error('Invalid mnemonic phrase');
      }
    } else {
      // It's already a private key
      privateKey = privateKeyOrMnemonic;
    }

    const [contractAddress, contractName] = oracleContract.split('.');
    const network = config.stacks.network === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;

    logger.info('Updating oracle contract', {
      contract: oracleContract,
      network: config.stacks.network,
    });

    try {
      // Log private key format (first 10 chars only for security)
      logger.debug('Private key format check', {
        length: privateKey.length,
        prefix: privateKey.substring(0, 10),
      });

      // Create contract call transaction using update-all-data for APY and TVL
      const txOptions = {
        contractAddress,
        contractName,
        functionName: 'update-all-data',
        functionArgs: [
          uintCV(apyData.alexApy),
          uintCV(apyData.velarApy),
          uintCV(apyData.alexTvl),
          uintCV(apyData.velarTvl),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: BigInt(10000), // 0.01 STX (needs to be BigInt)
      };

      logger.debug('Creating contract call transaction', {
        contractAddress,
        contractName,
        functionName: 'update-all-data',
        alexApy: apyData.alexApy,
        velarApy: apyData.velarApy,
        alexTvl: apyData.alexTvl,
        velarTvl: apyData.velarTvl,
      });

      const transaction = await makeContractCall(txOptions);

      if (!transaction) {
        throw new Error('makeContractCall returned undefined');
      }

      logger.debug('Transaction created, broadcasting...');

      try {
        const broadcastResponse = await broadcastTransaction({
          transaction,
          network,
        });

        if ('error' in broadcastResponse) {
          throw new Error(`Transaction broadcast failed: ${broadcastResponse.error}`);
        }

        logger.info('Oracle update transaction broadcasted', {
          txId: broadcastResponse.txid,
          alex: `${apyData.alexApy / 100}% APY, ${(apyData.alexTvl / 100000000).toFixed(4)} BTC TVL`,
          velar: `${apyData.velarApy / 100}% APY, ${(apyData.velarTvl / 100000000).toFixed(4)} BTC TVL`,
        });
      } catch (broadcastError) {
        logger.error('Broadcast error details', {
          error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
          stack: broadcastError instanceof Error ? broadcastError.stack : undefined,
        });
        throw broadcastError;
      }
    } catch (error) {
      logger.error('Failed to update oracle contract', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Get last synced APY data
   */
  getLastAPY(): APYData | null {
    return this.lastApyData ? { ...this.lastApyData } : null;
  }

  /**
   * Force an immediate sync (bypasses threshold check)
   */
  async forceSync(): Promise<void> {
    logger.info('Forcing immediate sync');
    this.lastApyData = null; // Reset to force update
    await this.performSync();
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.syncInterval !== null;
  }
}

// Export singleton instance
export const oracleSyncService = new OracleSyncService();
