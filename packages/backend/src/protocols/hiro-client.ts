import { fetchCallReadOnlyFunction, cvToJSON, ClarityValue } from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { config } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import type { ContractCallParams } from '../types/protocols.js';

const logger = createLogger('hiro-client');

/**
 * Hiro API Client for Stacks blockchain queries
 * Provides methods to call read-only functions on smart contracts
 */
export class HiroClient {
  private network: typeof STACKS_MAINNET | typeof STACKS_TESTNET;
  private apiUrl: string;

  constructor() {
    this.apiUrl = config.stacks.apiUrl;
    this.network = config.stacks.network === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;

    logger.info('HiroClient initialized', {
      network: config.stacks.network,
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Call a read-only function on a deployed smart contract
   */
  async callReadOnly<T = any>(params: ContractCallParams): Promise<T> {
    const { contractAddress, contractName, functionName, functionArgs, senderAddress } = params;

    try {
      logger.debug('Calling read-only function', {
        contract: `${contractAddress}.${contractName}`,
        function: functionName,
      });

      const result = await fetchCallReadOnlyFunction({
        network: this.network,
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        senderAddress,
      });

      // Convert Clarity value to JSON
      const jsonResult = cvToJSON(result);
      logger.debug('Read-only call successful', {
        contract: `${contractAddress}.${contractName}`,
        function: functionName,
        result: jsonResult,
      });

      return jsonResult.value as T;
    } catch (error) {
      logger.error('Read-only call failed', {
        contract: `${contractAddress}.${contractName}`,
        function: functionName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to call ${functionName}: ${error}`);
    }
  }

  /**
   * Call a read-only function with retry logic
   */
  async callReadOnlyWithRetry<T = any>(
    params: ContractCallParams,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callReadOnly<T>(params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Read-only call attempt ${attempt}/${maxRetries} failed`, {
          contract: `${params.contractAddress}.${params.contractName}`,
          function: params.functionName,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Read-only call failed after retries');
  }

  /**
   * Get contract data map entry
   */
  async getMapEntry<T = any>(
    contractAddress: string,
    contractName: string,
    mapName: string,
    key: ClarityValue,
    senderAddress: string
  ): Promise<T | null> {
    try {
      const result = await this.callReadOnly<{ type: string; value: T }>({
        contractAddress,
        contractName,
        functionName: `get-${mapName}`,
        functionArgs: [key],
        senderAddress,
      });

      if (result && result.type !== 'none') {
        return result.value;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get map entry', {
        contract: `${contractAddress}.${contractName}`,
        map: mapName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch contract info from Hiro API
   */
  async getContractInfo(contractAddress: string, contractName: string) {
    const url = `${this.apiUrl}/v2/contracts/interface/${contractAddress}/${contractName}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Contract info fetched', {
        contract: `${contractAddress}.${contractName}`,
      });
      return data;
    } catch (error) {
      logger.error('Failed to fetch contract info', {
        contract: `${contractAddress}.${contractName}`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get account balances
   */
  async getAccountBalance(address: string): Promise<any> {
    const url = `${this.apiUrl}/extended/v1/address/${address}/balances`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Account balance fetched', { address });
      return data;
    } catch (error) {
      logger.error('Failed to fetch account balance', {
        address,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get contract events
   */
  async getContractEvents(contractAddress: string, contractName: string, limit: number = 20) {
    const url = `${this.apiUrl}/extended/v1/contract/${contractAddress}.${contractName}/events?limit=${limit}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      logger.debug('Contract events fetched', {
        contract: `${contractAddress}.${contractName}`,
        count: data.results?.length || 0,
      });
      return data;
    } catch (error) {
      logger.error('Failed to fetch contract events', {
        contract: `${contractAddress}.${contractName}`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Parse Clarity uint value
   */
  parseUint(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseInt(value, 10);
    if (value && typeof value === 'object' && 'value' in value) {
      return parseInt(value.value, 10);
    }
    throw new Error(`Cannot parse uint from ${JSON.stringify(value)}`);
  }

  /**
   * Parse Clarity bool value
   */
  parseBool(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value === true || value.value === 'true';
    }
    throw new Error(`Cannot parse bool from ${JSON.stringify(value)}`);
  }

  /**
   * Parse Clarity principal value
   */
  parsePrincipal(value: any): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'value' in value) {
      return value.value;
    }
    throw new Error(`Cannot parse principal from ${JSON.stringify(value)}`);
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for Hiro API
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; latency?: number }> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.apiUrl}/extended/v1/status`);
      const latency = Date.now() - startTime;

      if (response.ok) {
        logger.debug('Hiro API health check passed', { latency });
        return { status: 'up', latency };
      }

      logger.warn('Hiro API health check failed', { status: response.status });
      return { status: 'down' };
    } catch (error) {
      logger.error('Hiro API health check error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'down' };
    }
  }
}

// Export singleton instance
export const hiroClient = new HiroClient();
export default hiroClient;
