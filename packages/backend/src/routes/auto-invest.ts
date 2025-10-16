/**
 * Auto-Investment API Routes
 * Handles automated investment strategy generation and execution
 */

import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../config/logger.js';
import { strategyExecutor } from '../services/strategy-executor.js';
import { RiskLevel } from '../types/yield.js';

const router = Router();
const logger = createLogger('auto-invest-api');

// Request validation schemas
const GenerateStrategySchema = z.object({
  userAddress: z.string().min(1, 'User address is required'),
  sbtcAmount: z.number().positive('sBTC amount must be positive'),
  riskTolerance: z.enum(['low', 'medium', 'high']),
  timeHorizon: z.number().min(1).max(365).optional().default(30)
});

const ExecuteStrategySchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  userAddress: z.string().min(1, 'User address is required'),
  confirmExecution: z.boolean().default(false)
});

const RebalanceCheckSchema = z.object({
  userAddress: z.string().min(1, 'User address is required'),
  currentStrategyId: z.string().min(1, 'Current strategy ID is required')
});

/**
 * POST /api/auto-invest/generate-strategy
 * Generate optimal investment strategy for user deposit
 */
router.post('/generate-strategy', async (req, res) => {
  try {
    const validatedData = GenerateStrategySchema.parse(req.body);
    
    logger.info('Generating investment strategy', {
      userAddress: validatedData.userAddress,
      sbtcAmount: validatedData.sbtcAmount,
      riskTolerance: validatedData.riskTolerance
    });

    // Convert sBTC to sats for internal processing
    const sbtcAmountSats = Math.floor(validatedData.sbtcAmount * 100_000_000);
    
    const strategy = await strategyExecutor.generateOptimalStrategy(
      validatedData.userAddress,
      sbtcAmountSats,
      validatedData.riskTolerance as RiskLevel,
      validatedData.timeHorizon
    );

    // Convert back to sBTC for response
    const responseStrategy = {
      ...strategy,
      totalAmount: strategy.totalAmount / 100_000_000,
      allocations: strategy.allocations.map(alloc => ({
        ...alloc,
        amount: alloc.amount / 100_000_000
      }))
    };

    logger.info('Strategy generated successfully', {
      strategyId: strategy.strategyId,
      expectedAPY: strategy.expectedAPY.toFixed(2),
      allocations: strategy.allocations.length
    });

    res.json({
      success: true,
      strategy: responseStrategy,
      message: 'Investment strategy generated successfully'
    });

  } catch (error) {
    logger.error('Strategy generation failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate investment strategy',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auto-invest/execute-strategy
 * Execute investment strategy (Phase 1A: Simulation, Phase 1B: Real execution)
 */
router.post('/execute-strategy', async (req, res) => {
  try {
    const validatedData = ExecuteStrategySchema.parse(req.body);
    
    logger.info('Executing investment strategy', {
      strategyId: validatedData.strategyId,
      userAddress: validatedData.userAddress,
      confirmExecution: validatedData.confirmExecution
    });

    if (!validatedData.confirmExecution) {
      return res.status(400).json({
        success: false,
        error: 'Execution confirmation required',
        message: 'Set confirmExecution to true to execute the strategy'
      });
    }

    // Phase 1A: Simulate execution
    // In Phase 1B: Add real smart contract calls
    
    const simulatedResult = {
      success: true,
      strategyId: validatedData.strategyId,
      executedAllocations: [
        {
          protocol: 'velar' as const,
          poolId: 'velar-sbtc-stx',
          amount: 1.0, // sBTC
          percentage: 100,
          expectedAPY: 12.61,
          riskLevel: 'low' as const
        }
      ],
      totalGasCost: 5000, // microSTX
      estimatedAPY: 12.61,
      executionTime: 2500, // ms
      message: 'Phase 1A: Strategy execution simulated successfully'
    };

    logger.info('Strategy execution completed', {
      strategyId: validatedData.strategyId,
      success: simulatedResult.success,
      estimatedAPY: simulatedResult.estimatedAPY
    });

    res.json({
      success: true,
      result: simulatedResult,
      message: 'Investment strategy executed successfully (simulated)'
    });

  } catch (error) {
    logger.error('Strategy execution failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to execute investment strategy',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/auto-invest/check-rebalancing
 * Check if rebalancing is needed for user's current strategy
 */
router.post('/check-rebalancing', async (req, res) => {
  try {
    const validatedData = RebalanceCheckSchema.parse(req.body);
    
    logger.info('Checking rebalancing conditions', {
      userAddress: validatedData.userAddress,
      currentStrategyId: validatedData.currentStrategyId
    });

    // Phase 1A: Simulate rebalancing check
    // In Phase 1B: Add real strategy comparison
    
    const simulatedCheck = {
      shouldRebalance: false,
      currentAPY: 12.61,
      potentialAPY: 12.85,
      improvement: 0.24,
      trigger: null,
      message: 'No rebalancing needed - improvement below 2% threshold'
    };

    logger.info('Rebalancing check completed', {
      shouldRebalance: simulatedCheck.shouldRebalance,
      improvement: simulatedCheck.improvement
    });

    res.json({
      success: true,
      rebalancing: simulatedCheck,
      message: 'Rebalancing check completed'
    });

  } catch (error) {
    logger.error('Rebalancing check failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to check rebalancing conditions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auto-invest/strategy/:strategyId
 * Get strategy details by ID
 */
router.get('/strategy/:strategyId', async (req, res) => {
  try {
    const strategyId = req.params.strategyId;
    
    logger.info('Fetching strategy details', { strategyId });

    // Phase 1A: Simulate strategy retrieval
    // In Phase 1B: Add real strategy storage and retrieval
    
    const simulatedStrategy = {
      strategyId,
      userAddress: 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE',
      totalAmount: 1.0, // sBTC
      riskTolerance: 'medium' as const,
      timeHorizon: 30,
      allocations: [
        {
          protocol: 'velar' as const,
          poolId: 'velar-sbtc-stx',
          amount: 1.0,
          percentage: 100,
          expectedAPY: 12.61,
          riskLevel: 'low' as const
        }
      ],
      expectedAPY: 12.61,
      riskScore: 3,
      createdAt: Date.now() - 3600000, // 1 hour ago
      status: 'active'
    };

    res.json({
      success: true,
      strategy: simulatedStrategy,
      message: 'Strategy details retrieved successfully'
    });

  } catch (error) {
    logger.error('Strategy retrieval failed', {
      error: error instanceof Error ? error.message : String(error),
      strategyId: req.params.strategyId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve strategy details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auto-invest/user/:userAddress/strategies
 * Get all strategies for a user
 */
router.get('/user/:userAddress/strategies', async (req, res) => {
  try {
    const userAddress = req.params.userAddress;
    
    logger.info('Fetching user strategies', { userAddress });

    // Phase 1A: Simulate user strategies
    const simulatedStrategies = [
      {
        strategyId: `strategy_${userAddress}_${Date.now() - 86400000}`,
        totalAmount: 1.0,
        expectedAPY: 12.61,
        status: 'active',
        createdAt: Date.now() - 86400000, // 1 day ago
        allocations: 1
      }
    ];

    res.json({
      success: true,
      strategies: simulatedStrategies,
      count: simulatedStrategies.length,
      message: 'User strategies retrieved successfully'
    });

  } catch (error) {
    logger.error('User strategies retrieval failed', {
      error: error instanceof Error ? error.message : String(error),
      userAddress: req.params.userAddress
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user strategies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
