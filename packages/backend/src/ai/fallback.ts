import { createLogger } from '../config/logger.js';
import {
  type Recommendation,
  type YieldOpportunity,
  type UserPreference,
  RiskTolerance,
  type AlternativeRecommendation,
} from '../types/yield.js';

const logger = createLogger('fallback-recommender');

/**
 * Rule-Based Fallback Recommendation System
 * Provides recommendations when AI is unavailable or fails
 */
export class FallbackRecommender {
  /**
   * Generate rule-based recommendation
   */
  async recommend(
    opportunities: YieldOpportunity[],
    userPreference: UserPreference
  ): Promise<Recommendation> {
    logger.info('Generating fallback recommendation', {
      opportunityCount: opportunities.length,
      riskTolerance: userPreference.riskTolerance,
    });

    // Filter opportunities based on user preferences
    const filtered = this.filterByPreferences(opportunities, userPreference);

    if (filtered.length === 0) {
      throw new Error('No suitable opportunities found matching your criteria');
    }

    // Score and rank opportunities
    const scored = this.scoreOpportunities(filtered, userPreference);

    // Sort by score (descending)
    const sorted = scored.sort((a, b) => b.score - a.score);

    // Primary recommendation
    const primary = sorted[0];

    // Alternatives (next 2-3 best options)
    const alternatives = sorted.slice(1, 4).map(s => this.createAlternative(s.opportunity));

    // Calculate projected earnings
    const projectedEarnings = this.calculateEarnings(
      userPreference.amount,
      primary.opportunity.apy
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(primary.opportunity, userPreference);

    // Generate risk assessment
    const riskAssessment = this.generateRiskAssessment(primary.opportunity);

    // Generate warnings
    const warnings = this.generateWarnings(primary.opportunity);

    const recommendation: Recommendation = {
      protocol: primary.opportunity.protocol,
      poolId: primary.opportunity.poolId,
      poolName: primary.opportunity.poolName,
      expectedAPY: primary.opportunity.apy,
      riskLevel: primary.opportunity.riskLevel,
      impermanentLossRisk: primary.opportunity.impermanentLossRisk,
      reasoning,
      riskAssessment,
      alternatives,
      projectedEarnings,
      confidenceScore: this.calculateConfidence(primary.opportunity, userPreference),
      warnings,
      disclaimers: [
        'DeFi yields are volatile and not guaranteed',
        'Past performance does not indicate future results',
        'Only invest what you can afford to lose',
        'This is an automated recommendation - please do your own research',
      ],
      generatedAt: Date.now(),
      dataFreshness: this.calculateDataFreshness(opportunities),
      source: 'rule_based',
    };

    logger.info('Fallback recommendation generated', {
      protocol: recommendation.protocol,
      poolId: recommendation.poolId,
      score: primary.score,
    });

    return recommendation;
  }

  /**
   * Filter opportunities by user preferences
   */
  private filterByPreferences(
    opportunities: YieldOpportunity[],
    pref: UserPreference
  ): YieldOpportunity[] {
    return opportunities.filter(opp => {
      // Risk tolerance filter
      if (!this.matchesRiskTolerance(opp.riskLevel, pref.riskTolerance)) {
        return false;
      }

      // Minimum APY filter
      if (pref.minApy !== undefined && opp.apy < pref.minApy) {
        return false;
      }

      // Impermanent loss filter
      if (pref.avoidImpermanentLoss && opp.impermanentLossRisk) {
        return false;
      }

      // Lock period filter
      if (pref.maxLockPeriod !== undefined && (opp.lockPeriod || 0) > pref.maxLockPeriod) {
        return false;
      }

      // Preferred protocols filter
      if (pref.preferredProtocols && !pref.preferredProtocols.includes(opp.protocol)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if risk level matches user tolerance
   */
  private matchesRiskTolerance(riskLevel: string, tolerance: RiskTolerance): boolean {
    const riskMap = {
      [RiskTolerance.CONSERVATIVE]: ['low'],
      [RiskTolerance.MODERATE]: ['low', 'medium'],
      [RiskTolerance.AGGRESSIVE]: ['low', 'medium', 'high'],
    };

    return riskMap[tolerance].includes(riskLevel);
  }

  /**
   * Score opportunities using weighted formula
   */
  private scoreOpportunities(
    opportunities: YieldOpportunity[],
    pref: UserPreference
  ): Array<{ opportunity: YieldOpportunity; score: number }> {
    return opportunities.map(opp => ({
      opportunity: opp,
      score: this.calculateScore(opp, pref),
    }));
  }

  /**
   * Calculate score for an opportunity
   * Formula: APY × log10(TVL) × risk_factor × preference_bonus
   */
  private calculateScore(opp: YieldOpportunity, pref: UserPreference): number {
    // Base APY component
    let apyScore = opp.apy;

    // TVL component (log scale)
    const tvlScore = Math.log10(Math.max(opp.tvl, 1000));

    // Risk multipliers (conservative users prefer safety)
    const riskMultipliers = {
      conservative: { low: 1.0, medium: 0.5, high: 0.1 },
      moderate: { low: 1.0, medium: 0.8, high: 0.5 },
      aggressive: { low: 0.8, medium: 1.0, high: 1.2 },
    };
    const riskFactor =
      riskMultipliers[pref.riskTolerance][
        opp.riskLevel as keyof typeof riskMultipliers.conservative
      ];

    // Protocol preference bonus
    const protocolBonus = pref.preferredProtocols?.includes(opp.protocol) ? 1.2 : 1.0;

    // Penalty for lock periods (if user prefers liquidity)
    const lockPenalty = (opp.lockPeriod || 0) > 0 ? 0.95 : 1.0;

    // Penalty for fees
    const totalFees = opp.depositFee + opp.withdrawalFee + opp.performanceFee;
    const feePenalty = Math.max(0.7, 1 - totalFees / 100);

    // Calculate final score
    const score = apyScore * tvlScore * riskFactor * protocolBonus * lockPenalty * feePenalty;

    return score;
  }

  /**
   * Create alternative recommendation
   */
  private createAlternative(opp: YieldOpportunity): AlternativeRecommendation {
    return {
      protocol: opp.protocol,
      poolId: opp.poolId,
      poolName: opp.poolName,
      apy: opp.apy,
      tvl: opp.tvl,
      riskLevel: opp.riskLevel,
      pros: this.generatePros(opp),
      cons: this.generateCons(opp),
    };
  }

  /**
   * Generate pros for an opportunity
   */
  private generatePros(opp: YieldOpportunity): string {
    const pros: string[] = [];

    if (opp.apy > 15) pros.push('High APY');
    if (opp.tvl > 10000000) pros.push('High liquidity');
    if (opp.riskLevel === 'low') pros.push('Low risk');
    if (!opp.lockPeriod || opp.lockPeriod === 0) pros.push('No lock period');
    if (opp.auditStatus === 'audited') pros.push('Audited protocol');
    if (!opp.impermanentLossRisk) pros.push('No IL risk');

    return pros.join(', ') || 'Stable returns';
  }

  /**
   * Generate cons for an opportunity
   */
  private generateCons(opp: YieldOpportunity): string {
    const cons: string[] = [];

    if (opp.apy < 5) cons.push('Lower APY');
    if (opp.tvl < 2000000) cons.push('Limited liquidity');
    if (opp.riskLevel === 'high') cons.push('Higher risk');
    if (opp.lockPeriod && opp.lockPeriod > 0) cons.push(`${opp.lockPeriod}-day lock`);
    if (opp.impermanentLossRisk) cons.push('IL risk');
    if (opp.performanceFee > 5) cons.push(`${opp.performanceFee}% performance fee`);

    return cons.join(', ') || 'Consider fees and risks';
  }

  /**
   * Calculate projected earnings
   */
  private calculateEarnings(
    amount: number,
    apy: number
  ): { daily: number; monthly: number; yearly: number } {
    const amountBTC = amount / 100000000; // Convert sats to BTC
    const yearlyBTC = (amountBTC * apy) / 100;

    return {
      daily: yearlyBTC / 365,
      monthly: yearlyBTC / 12,
      yearly: yearlyBTC,
    };
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(opp: YieldOpportunity, pref: UserPreference): string {
    const parts: string[] = [];

    // Risk alignment
    if (pref.riskTolerance === RiskTolerance.CONSERVATIVE && opp.riskLevel === 'low') {
      parts.push(
        `This ${opp.protocol} ${opp.protocolType} aligns with your conservative risk profile`
      );
    } else if (pref.riskTolerance === RiskTolerance.AGGRESSIVE && opp.apy > 15) {
      parts.push(`High ${opp.apy.toFixed(1)}% APY matches your aggressive strategy`);
    } else {
      parts.push(
        `Balanced ${opp.apy.toFixed(1)}% APY with ${opp.riskLevel} risk suits moderate investors`
      );
    }

    // TVL security
    if (opp.tvl > 10000000) {
      parts.push(`with strong liquidity ($${(opp.tvl / 1000000).toFixed(1)}M TVL)`);
    }

    // Additional benefits
    if (!opp.impermanentLossRisk && !opp.lockPeriod) {
      parts.push('offering flexible withdrawals without impermanent loss');
    } else if (!opp.lockPeriod) {
      parts.push('with no lock-up period for flexibility');
    }

    return parts.join(' ') + '.';
  }

  /**
   * Generate risk assessment
   */
  private generateRiskAssessment(opp: YieldOpportunity): string {
    const risks: string[] = [];

    if (opp.impermanentLossRisk) {
      risks.push('Liquidity provision carries impermanent loss risk if token prices diverge');
    }

    if (opp.lockPeriod && opp.lockPeriod > 0) {
      risks.push(`Funds locked for ${opp.lockPeriod} days - cannot withdraw early`);
    }

    if (opp.riskLevel === 'high') {
      risks.push('Higher risk due to protocol complexity or limited track record');
    }

    if (opp.tvl < 5000000) {
      risks.push('Relatively low TVL may impact liquidity during high volatility');
    }

    if (opp.performanceFee > 10) {
      risks.push(`${opp.performanceFee}% performance fee reduces net returns`);
    }

    // Add protocol-specific risks
    if (opp.riskFactors && opp.riskFactors.length > 0) {
      risks.push(...opp.riskFactors.slice(0, 2));
    }

    return risks.join('. ') + '.' || 'Standard DeFi risks apply.';
  }

  /**
   * Generate warnings
   */
  private generateWarnings(opp: YieldOpportunity): string[] {
    const warnings: string[] = [];

    if (opp.apy > 50) {
      warnings.push('Extremely high APY may be unsustainable - proceed with caution');
    }

    if (opp.auditStatus !== 'audited') {
      warnings.push('Protocol is not audited - higher smart contract risk');
    }

    if (opp.tvl < 1000000) {
      warnings.push('Low TVL - limited liquidity and higher risk');
    }

    return warnings;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(opp: YieldOpportunity, pref: UserPreference): number {
    let confidence = 0.5; // Base confidence for rule-based system

    // Increase for high TVL (more data = more confidence)
    if (opp.tvl > 10000000) confidence += 0.2;
    else if (opp.tvl > 5000000) confidence += 0.1;

    // Increase for audited protocols
    if (opp.auditStatus === 'audited') confidence += 0.1;

    // Increase for risk alignment
    if (this.matchesRiskTolerance(opp.riskLevel, pref.riskTolerance)) {
      confidence += 0.1;
    }

    // Decrease for unusually high APY
    if (opp.apy > 100) confidence -= 0.2;

    return Math.min(0.9, Math.max(0.3, confidence)); // Clamp between 0.3-0.9
  }

  /**
   * Calculate data freshness
   */
  private calculateDataFreshness(opportunities: YieldOpportunity[]): number {
    if (opportunities.length === 0) return 0;

    const now = Date.now();
    const ages = opportunities.map(opp => (now - opp.updatedAt) / 1000);
    return Math.max(...ages);
  }
}

// Export singleton instance
export const fallbackRecommender = new FallbackRecommender();
export default fallbackRecommender;
