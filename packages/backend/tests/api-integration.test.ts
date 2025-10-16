/**
 * API Integration Tests for BitYield Backend
 * Tests all BitYield endpoints with real testnet contract data
 */

import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3001';
const TEST_ADDRESS = 'STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ'; // Testnet deployer

describe('BitYield API Integration Tests', () => {
  describe('Root Endpoint', () => {
    it('should return API information', async () => {
      const response = await fetch(API_BASE);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('BitYield AI Backend');
      expect(data.version).toBe('1.0.0');
      expect(data.endpoints.bityield).toBeDefined();
      expect(data.endpoints.bityield.apy).toBe('GET /api/bityield/apy');
      expect(data.endpoints.bityield.tvl).toBe('GET /api/bityield/tvl');
      expect(data.endpoints.bityield.pools).toBe('GET /api/bityield/pools');
      expect(data.endpoints.bityield.user).toBe('GET /api/bityield/user/:address');
      expect(data.endpoints.bityield.stats).toBe('GET /api/bityield/stats');
    });
  });

  describe('GET /api/bityield/apy', () => {
    it('should return APY values from pool oracle', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/apy`);
      const data = await response.json();

      console.log('APY Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.alex).toBeDefined();
      expect(data.data.velar).toBeDefined();
      expect(data.data.alex.apy).toBeTypeOf('number');
      expect(data.data.velar.apy).toBeTypeOf('number');
      expect(data.data.alex.apyFormatted).toMatch(/%$/);
      expect(data.data.velar.apyFormatted).toMatch(/%$/);
      expect(data.data.lastUpdated).toBeTypeOf('number');
    });
  });

  describe('GET /api/bityield/tvl', () => {
    it('should return vault TVL and statistics', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/tvl`);
      const data = await response.json();

      console.log('TVL Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.totalTvl).toBeTypeOf('number');
      expect(data.data.totalTvlBTC).toBeTypeOf('number');
      expect(data.data.totalTvlFormatted).toMatch(/BTC$/);
      expect(data.data.depositorCount).toBeTypeOf('number');
      expect(data.data.isPaused).toBeTypeOf('boolean');
      expect(data.data.totalTvl).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/bityield/pools', () => {
    it('should return statistics for both pools', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/pools`);
      const data = await response.json();

      console.log('Pools Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();

      // ALEX pool
      expect(data.data.alex).toBeDefined();
      expect(data.data.alex.tvl).toBeTypeOf('number');
      expect(data.data.alex.tvlBTC).toBeTypeOf('number');
      expect(data.data.alex.apy).toBeTypeOf('number');
      expect(data.data.alex.apyFormatted).toMatch(/%$/);
      expect(data.data.alex.isPaused).toBeTypeOf('boolean');

      // Velar pool
      expect(data.data.velar).toBeDefined();
      expect(data.data.velar.tvl).toBeTypeOf('number');
      expect(data.data.velar.tvlBTC).toBeTypeOf('number');
      expect(data.data.velar.apy).toBeTypeOf('number');
      expect(data.data.velar.apyFormatted).toMatch(/%$/);
      expect(data.data.velar.isPaused).toBeTypeOf('boolean');

      // Total
      expect(data.data.total).toBeDefined();
      expect(data.data.total.tvl).toBe(data.data.alex.tvl + data.data.velar.tvl);
    });
  });

  describe('GET /api/bityield/user/:address', () => {
    it('should return user balance and positions', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/user/${TEST_ADDRESS}`);
      const data = await response.json();

      console.log('User Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();

      // Vault balance
      expect(data.data.vaultBalance).toBeTypeOf('number');
      expect(data.data.vaultBalanceBTC).toBeTypeOf('number');
      expect(data.data.vaultBalanceFormatted).toMatch(/BTC$/);

      // Allocations
      expect(data.data.allocations).toBeDefined();
      expect(data.data.allocations.alex).toBeDefined();
      expect(data.data.allocations.velar).toBeDefined();
      expect(data.data.allocations.alex.amount).toBeTypeOf('number');
      expect(data.data.allocations.velar.amount).toBeTypeOf('number');
      expect(data.data.allocations.alex.percentage).toMatch(/^[\d.]+$/);
      expect(data.data.allocations.velar.percentage).toMatch(/^[\d.]+$/);

      // Total value with yield
      expect(data.data.totalValueWithYield).toBeDefined();
      expect(data.data.totalValueWithYield.amount).toBeTypeOf('number');

      // Yield
      expect(data.data.yield).toBeDefined();
      expect(data.data.yield.amount).toBeTypeOf('number');

      // Risk preference
      expect(data.data.riskPreference).toBeDefined();
      expect(data.data.riskPreference.value).toBeTypeOf('number');
      expect(data.data.riskPreference.name).toMatch(/Conservative|Moderate|Aggressive/);
    });

    it('should return data for address with no deposits', async () => {
      const emptyAddress = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
      const response = await fetch(`${API_BASE}/api/bityield/user/${emptyAddress}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.vaultBalance).toBe(0);
      expect(data.data.allocations.alex.amount).toBe(0);
      expect(data.data.allocations.velar.amount).toBe(0);
    });
  });

  describe('GET /api/bityield/stats', () => {
    it('should return comprehensive statistics', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/stats`);
      const data = await response.json();

      console.log('Stats Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();

      // Vault stats
      expect(data.data.vault).toBeDefined();
      expect(data.data.vault.tvl).toBeTypeOf('number');
      expect(data.data.vault.depositors).toBeTypeOf('number');
      expect(data.data.vault.isPaused).toBeTypeOf('boolean');

      // Pool stats
      expect(data.data.pools).toBeDefined();
      expect(data.data.pools.alex).toBeDefined();
      expect(data.data.pools.velar).toBeDefined();
      expect(data.data.pools.combined).toBeDefined();

      // APY info
      expect(data.data.apy).toBeDefined();
      expect(data.data.apy.lastUpdated).toBeTypeOf('number');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/unknown`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should handle invalid address format gracefully', async () => {
      const response = await fetch(`${API_BASE}/api/bityield/user/invalid`);
      // Should either return data or proper error, not crash
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
