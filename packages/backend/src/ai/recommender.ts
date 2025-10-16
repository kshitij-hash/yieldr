import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import {
  RecommendationSchema,
  type Recommendation,
  type YieldOpportunity,
  type UserPreference,
} from '../types/yield.js';

const logger = createLogger('ai-recommender');

/**
 * AI-Powered Yield Recommendation Engine
 * Uses OpenAI GPT-4 to provide personalized sBTC yield recommendations
 */
export class AIRecommender {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.model = config.openai.model;
    this.temperature = config.openai.temperature;
    this.maxTokens = config.openai.maxTokens;

    logger.info('AI Recommender initialized', {
      model: this.model,
      temperature: this.temperature,
    });
  }

  /**
   * Generate AI-powered yield recommendation
   */
  async recommend(
    opportunities: YieldOpportunity[],
    userPreference: UserPreference
  ): Promise<Recommendation> {
    logger.info('Generating AI recommendation', {
      opportunityCount: opportunities.length,
      amount: userPreference.amount,
      riskTolerance: userPreference.riskTolerance,
    });

    try {
      // Prepare the prompt
      const prompt = this.constructPrompt(opportunities, userPreference);

      // Call OpenAI with structured output
      const completion = await this.client.beta.chat.completions.parse({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: zodResponseFormat(RecommendationSchema, 'recommendation'),
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const message = completion.choices[0]?.message;

      if (!message?.parsed) {
        throw new Error('Failed to parse AI response');
      }

      const recommendation = message.parsed;

      // Enhance recommendation with additional metadata
      const enhanced: Recommendation = {
        ...recommendation,
        generatedAt: Date.now(),
        dataFreshness: this.calculateDataFreshness(opportunities),
        source: 'ai',
      };

      logger.info('AI recommendation generated', {
        protocol: enhanced.protocol,
        poolId: enhanced.poolId,
        expectedAPY: enhanced.expectedAPY,
        confidenceScore: enhanced.confidenceScore,
      });

      return enhanced;
    } catch (error) {
      logger.error('AI recommendation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get system prompt for AI
   */
  private getSystemPrompt(): string {
    return `You are a Bitcoin DeFi expert specializing in sBTC yield optimization on the Stacks blockchain. Your role is to analyze yield opportunities and provide personalized, data-driven recommendations.

CRITICAL: You MUST ONLY recommend from the opportunities provided in the user's message. DO NOT recommend any protocol, pool, or opportunity that is not explicitly listed in the AVAILABLE OPPORTUNITIES section. If a protocol has no opportunities listed, it means it's not available and you MUST NOT recommend it.

Key principles:
1. Prioritize capital preservation for conservative users
2. Consider risk-adjusted returns, not just APY
3. Account for hidden costs (fees, impermanent loss, lock periods)
4. Prefer audited protocols with high TVL for safety
5. Warn about unusually high APYs that may be unsustainable
6. Consider user's deposit amount and time horizon
7. Only recommend from the actual opportunities provided - do not hallucinate or invent pools

Protocol information (for context only - ONLY recommend pools that appear in the opportunities list):
- Velar: DEX with liquidity pools, medium-high risk due to impermanent loss
- ALEX: Yield farming and staking, variable risk based on farm type

Analyze the provided yield opportunities and user preferences, then recommend the single best option from the AVAILABLE OPPORTUNITIES with clear reasoning. Include 2-3 alternatives for comparison, also from the AVAILABLE OPPORTUNITIES only.`;
  }

  /**
   * Construct the user prompt with yield data
   */
  private constructPrompt(
    opportunities: YieldOpportunity[],
    userPreference: UserPreference
  ): string {
    // Summarize opportunities
    const oppSummary = opportunities.map(opp => ({
      protocol: opp.protocol,
      type: opp.protocolType,
      poolName: opp.poolName,
      apy: opp.apy.toFixed(2) + '%',
      tvl: this.formatUSD(opp.tvl),
      riskLevel: opp.riskLevel,
      lockPeriod: opp.lockPeriod ? `${opp.lockPeriod} days` : 'none',
      fees: {
        deposit: opp.depositFee + '%',
        withdrawal: opp.withdrawalFee + '%',
        performance: opp.performanceFee + '%',
      },
      impermanentLoss: opp.impermanentLossRisk,
      riskFactors: opp.riskFactors || [],
    }));

    const depositAmountBTC = userPreference.amount / 100000000;

    return `Please analyze these sBTC yield opportunities and recommend the best option for my needs.

CRITICAL CONSTRAINT: You MUST choose from the opportunities listed below. Do not recommend any pool, protocol, or opportunity that is not in this list.

MY PROFILE:
- Deposit Amount: ${depositAmountBTC.toFixed(4)} BTC (${userPreference.amount} sats)
- Risk Tolerance: ${userPreference.riskTolerance}
${userPreference.timeHorizon ? `- Time Horizon: ${userPreference.timeHorizon}-term` : ''}
${userPreference.minApy ? `- Minimum APY: ${userPreference.minApy}%` : ''}
${userPreference.avoidImpermanentLoss ? '- Avoid Impermanent Loss: Yes' : ''}
${userPreference.maxLockPeriod !== undefined ? `- Max Lock Period: ${userPreference.maxLockPeriod} days` : ''}
${userPreference.preferredProtocols ? `- Preferred Protocols: ${userPreference.preferredProtocols.join(', ')}` : ''}

AVAILABLE OPPORTUNITIES (${oppSummary.length} total):
${JSON.stringify(oppSummary, null, 2)}

Please provide:
1. Your PRIMARY recommendation (protocol, poolId, poolName, expected APY)
2. Clear reasoning (2-3 sentences explaining why this is best for my profile)
3. Risk assessment (potential downsides and warnings)
4. 2-3 alternative options with pros/cons
5. Projected earnings (daily, monthly, yearly based on my deposit amount)
6. Confidence score (0-1) in your recommendation

Consider:
- My risk tolerance and deposit amount
- Risk-adjusted returns (APY × TVL × risk factor)
- Total costs (all fees combined)
- Liquidity and lock periods
- Protocol maturity and audit status`;
  }

  /**
   * Format USD amount
   */
  private formatUSD(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  }

  /**
   * Calculate data freshness (age of oldest data in seconds)
   */
  private calculateDataFreshness(opportunities: YieldOpportunity[]): number {
    if (opportunities.length === 0) return 0;

    const now = Date.now();
    const ages = opportunities.map(opp => (now - opp.updatedAt) / 1000);
    return Math.max(...ages);
  }

  /**
   * Health check for OpenAI API
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; model?: string }> {
    try {
      // Simple test call
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });

      if (completion.choices[0]?.message) {
        logger.debug('OpenAI health check passed');
        return { status: 'up', model: this.model };
      }

      return { status: 'down' };
    } catch (error) {
      logger.error('OpenAI health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'down' };
    }
  }
}

// Export singleton instance
export const aiRecommender = new AIRecommender();
export default aiRecommender;
