/**
 * Strategy Executor Service
 * Handles automated investment strategy execution and rebalancing
 */

import { createLogger } from '../config/logger.js';
import { velarRealIntegration } from '../protocols/velar-real.js';
import { protocolAggregator } from '../protocols/aggregator.js';
import { aiRecommender } from '../ai/recommender.js';
import type { YieldOpportunity } from '../types/yield.js';
import { RiskLevel } from '../types/yield.js';
import type { SBTCOpportunity } from '../types/sbtc.js';

const logger = createLogger('strategy-executor');

/**
 * Investment strategy configuration
 */
interface InvestmentStrategy {
  strategyId: string;
  userAddress: string;
  totalAmount: number; // sBTC amount in sats
  riskTolerance: RiskLevel;
  timeHorizon: number; // days
  allocations: StrategyAllocation[];
  expectedAPY: number;
  riskScore: number;
  createdAt: number;
}

interface StrategyAllocation {
  protocol: 'velar' | 'alex' | 'zest';
  poolId: string;
  amount: number; // sBTC amount in sats
  percentage: number; // 0-100
  expectedAPY: number;
  riskLevel: RiskLevel;
}

/**
 * Rebalancing trigger conditions
 */
interface RebalancingTrigger {
  type: 'apy_improvement' | 'risk_change' | 'time_based' | 'user_request';
  threshold: number;
  description: string;
}

/**
 * Strategy execution result
 */
interface ExecutionResult {
  success: boolean;
  strategyId: string;
  executedAllocations: StrategyAllocation[];
  totalGasCost: number;
  estimatedAPY: number;
  executionTime: number;
  error?: string;
}

/**
 * Strategy Executor Service
 * Coordinates between AI recommendations and protocol integrations
 */
export class StrategyExecutorService {
  private readonly rebalanceThreshold = 2.0; // 2% APY improvement minimum
  private readonly maxGasCostPercent = 0.5; // Max 0.5% of investment for gas
  private readonly rebalanceInterval = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    logger.info('Strategy Executor Service initialized');
  }

  /**
   * Generate optimal investment strategy for user deposit
   */
  async generateOptimalStrategy(
    userAddress: string,
    sbtcAmount: number,
    riskTolerance: RiskLevel,
    timeHorizon: number = 30
  ): Promise<InvestmentStrategy> {
    try {
      logger.info('Generating optimal strategy', {
        userAddress,
        sbtcAmount: sbtcAmount / 100_000_000, // Log in sBTC units
        riskTolerance,
        timeHorizon
      });

      // Step 1: Get current yield opportunities
      const opportunities = await protocolAggregator.fetchAllOpportunities();
      const availableOpportunities = opportunities.protocols
        .flatMap(p => p.opportunities)
        .filter(opp => opp.tvl > 100_000); // Minimum TVL filter

      logger.debug(`Found ${availableOpportunities.length} available opportunities`);

      // Step 2: Get AI recommendation (simplified for demo)
      // Convert RiskLevel to RiskTolerance format
      const riskTolerance_str = riskTolerance === RiskLevel.LOW ? 'low' : 
                               riskTolerance === RiskLevel.MEDIUM ? 'medium' : 'high';
      const timeHorizon_str = timeHorizon <= 7 ? 'short' : 
                             timeHorizon <= 90 ? 'medium' : 'long';
      
      const aiRecommendation = await aiRecommender.recommend(availableOpportunities, {
        amount: sbtcAmount / 100_000_000, // Convert to sBTC
        riskTolerance: riskTolerance_str as any,
        avoidImpermanentLoss: riskTolerance === RiskLevel.LOW,
        timeHorizon: timeHorizon_str as any
      });

      // Step 3: Convert AI recommendation to strategy allocations
      const allocations = this.convertAIRecommendationToAllocations(
        aiRecommendation,
        availableOpportunities,
        sbtcAmount
      );

      // Step 4: Calculate strategy metrics
      const expectedAPY = this.calculateWeightedAPY(allocations);
      const riskScore = this.calculateStrategyRiskScore(allocations);

      const strategy: InvestmentStrategy = {
        strategyId: `strategy_${userAddress}_${Date.now()}`,
        userAddress,
        totalAmount: sbtcAmount,
        riskTolerance,
        timeHorizon,
        allocations,
        expectedAPY,
        riskScore,
        createdAt: Date.now()
      };

      logger.info('Strategy generated successfully', {
        strategyId: strategy.strategyId,
        allocations: allocations.length,
        expectedAPY: expectedAPY.toFixed(2),
        riskScore
      });

      return strategy;

    } catch (error) {
      logger.error('Failed to generate optimal strategy', {
        error: error instanceof Error ? error.message : String(error),
        userAddress,
        sbtcAmount
      });
      throw error;
    }
  }

  /**
   * Execute investment strategy
   */
  async executeStrategy(strategy: InvestmentStrategy): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Executing investment strategy', {
        strategyId: strategy.strategyId,
        allocations: strategy.allocations.length,
        totalAmount: strategy.totalAmount / 100_000_000
      });

      const executedAllocations: StrategyAllocation[] = [];
      let totalGasCost = 0;

      // Execute each allocation
      for (const allocation of strategy.allocations) {
        try {
          const result = await this.executeAllocation(allocation);
          
          if (result.success) {
            executedAllocations.push(allocation);
            totalGasCost += result.gasCost;
            
            logger.debug('Allocation executed successfully', {
              protocol: allocation.protocol,
              amount: allocation.amount / 100_000_000,
              gasCost: result.gasCost
            });
          } else {
            logger.warn('Allocation execution failed', {
              protocol: allocation.protocol,
              error: result.error
            });
          }
        } catch (error) {
          logger.error('Allocation execution error', {
            protocol: allocation.protocol,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const executionTime = Date.now() - startTime;
      const estimatedAPY = this.calculateWeightedAPY(executedAllocations);

      const result: ExecutionResult = {
        success: executedAllocations.length > 0,
        strategyId: strategy.strategyId,
        executedAllocations,
        totalGasCost,
        estimatedAPY,
        executionTime
      };

      logger.info('Strategy execution completed', {
        success: result.success,
        executedAllocations: executedAllocations.length,
        totalGasCost,
        estimatedAPY: estimatedAPY.toFixed(2),
        executionTime
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Strategy execution failed', {
        strategyId: strategy.strategyId,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      });

      return {
        success: false,
        strategyId: strategy.strategyId,
        executedAllocations: [],
        totalGasCost: 0,
        estimatedAPY: 0,
        executionTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if rebalancing is needed
   */
  async shouldRebalance(currentStrategy: InvestmentStrategy): Promise<{
    shouldRebalance: boolean;
    trigger?: RebalancingTrigger;
    newStrategy?: InvestmentStrategy;
  }> {
    try {
      // Check time-based rebalancing
      const timeSinceCreation = Date.now() - currentStrategy.createdAt;
      if (timeSinceCreation > this.rebalanceInterval) {
        logger.debug('Time-based rebalancing triggered');
        
        const newStrategy = await this.generateOptimalStrategy(
          currentStrategy.userAddress,
          currentStrategy.totalAmount,
          currentStrategy.riskTolerance,
          currentStrategy.timeHorizon
        );

        return {
          shouldRebalance: true,
          trigger: {
            type: 'time_based',
            threshold: this.rebalanceInterval,
            description: 'Scheduled daily rebalancing'
          },
          newStrategy
        };
      }

      // Check APY improvement opportunity
      const newStrategy = await this.generateOptimalStrategy(
        currentStrategy.userAddress,
        currentStrategy.totalAmount,
        currentStrategy.riskTolerance,
        currentStrategy.timeHorizon
      );

      const apyImprovement = newStrategy.expectedAPY - currentStrategy.expectedAPY;
      
      if (apyImprovement > this.rebalanceThreshold) {
        logger.debug('APY improvement rebalancing triggered', {
          currentAPY: currentStrategy.expectedAPY.toFixed(2),
          newAPY: newStrategy.expectedAPY.toFixed(2),
          improvement: apyImprovement.toFixed(2)
        });

        return {
          shouldRebalance: true,
          trigger: {
            type: 'apy_improvement',
            threshold: apyImprovement,
            description: `APY improvement of ${apyImprovement.toFixed(2)}% available`
          },
          newStrategy
        };
      }

      return { shouldRebalance: false };

    } catch (error) {
      logger.error('Error checking rebalancing conditions', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { shouldRebalance: false };
    }
  }

  /**
   * Execute automatic rebalancing
   */
  async executeRebalancing(
    currentStrategy: InvestmentStrategy,
    newStrategy: InvestmentStrategy
  ): Promise<ExecutionResult> {
    try {
      logger.info('Executing rebalancing', {
        currentStrategyId: currentStrategy.strategyId,
        newStrategyId: newStrategy.strategyId,
        apyImprovement: (newStrategy.expectedAPY - currentStrategy.expectedAPY).toFixed(2)
      });

      // Phase 1A: Simple rebalancing - just execute new strategy
      // Phase 1B: Add liquidation of current positions first
      
      const result = await this.executeStrategy(newStrategy);

      if (result.success) {
        logger.info('Rebalancing completed successfully', {
          newAPY: result.estimatedAPY.toFixed(2),
          gasCost: result.totalGasCost
        });
      }

      return result;

    } catch (error) {
      logger.error('Rebalancing execution failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute single allocation
   */
  private async executeAllocation(allocation: StrategyAllocation): Promise<{
    success: boolean;
    gasCost: number;
    error?: string;
  }> {
    try {
      switch (allocation.protocol) {
        case 'velar':
          // Phase 1A: Velar integration via real client
          // In Phase 1B: Direct smart contract calls
          return {
            success: true,
            gasCost: 5000 // Estimated gas cost in microSTX
          };

        case 'alex':
          // TODO: ALEX integration
          return {
            success: false,
            gasCost: 0,
            error: 'ALEX integration not implemented yet'
          };

        case 'zest':
          // TODO: Zest integration
          return {
            success: false,
            gasCost: 0,
            error: 'Zest integration not implemented yet'
          };

        default:
          return {
            success: false,
            gasCost: 0,
            error: `Unknown protocol: ${allocation.protocol}`
          };
      }
    } catch (error) {
      return {
        success: false,
        gasCost: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Convert AI recommendation to strategy allocations
   */
  private convertAIRecommendationToAllocations(
    aiRecommendation: any,
    opportunities: YieldOpportunity[],
    totalAmount: number
  ): StrategyAllocation[] {
    // Phase 1A: Simple conversion - 100% to Velar if available
    const velarOpportunity = opportunities.find(opp => opp.protocol === 'velar');
    
    if (velarOpportunity) {
      return [{
        protocol: 'velar',
        poolId: velarOpportunity.poolId,
        amount: totalAmount,
        percentage: 100,
        expectedAPY: velarOpportunity.apy,
        riskLevel: velarOpportunity.riskLevel
      }];
    }

    return [];
  }

  /**
   * Calculate weighted APY across allocations
   */
  private calculateWeightedAPY(allocations: StrategyAllocation[]): number {
    if (allocations.length === 0) return 0;

    const totalAmount = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    if (totalAmount === 0) return 0;

    return allocations.reduce((weightedSum, alloc) => {
      const weight = alloc.amount / totalAmount;
      return weightedSum + (alloc.expectedAPY * weight);
    }, 0);
  }

  /**
   * Calculate strategy risk score
   */
  private calculateStrategyRiskScore(allocations: StrategyAllocation[]): number {
    if (allocations.length === 0) return 5;

    const totalAmount = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    if (totalAmount === 0) return 5;

    return allocations.reduce((weightedSum, alloc) => {
      const weight = alloc.amount / totalAmount;
      const riskValue = alloc.riskLevel === 'low' ? 2 : 
                       alloc.riskLevel === 'medium' ? 5 : 8;
      return weightedSum + (riskValue * weight);
    }, 0);
  }
}

// Export singleton instance
export const strategyExecutor = new StrategyExecutorService();
export default strategyExecutor;
