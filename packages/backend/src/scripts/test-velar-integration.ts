/**
 * Test script for Velar sBTC integration
 * Validates real API integration and data processing
 */

import { velarSBTCClient } from '../protocols/velar-sbtc.js';
import { createLogger } from '../config/logger.js';

const logger = createLogger('velar-test');

async function testVelarIntegration() {
  console.log('🧪 Testing Velar sBTC Integration...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing API Health Check...');
    const healthStatus = await velarSBTCClient.healthCheck();
    console.log('Health Status:', healthStatus);
    
    if (healthStatus.status === 'down') {
      console.error('❌ Velar API is down, cannot proceed with tests');
      return;
    }
    console.log('✅ Velar API is healthy\n');

    // Test 2: Fetch sBTC Opportunities
    console.log('2️⃣ Fetching sBTC Opportunities...');
    const opportunities = await velarSBTCClient.fetchSBTCOpportunities();
    
    console.log(`Found ${opportunities.length} sBTC opportunities:`);
    
    opportunities.forEach((opp, index) => {
      console.log(`\n📊 Opportunity ${index + 1}:`);
      console.log(`   Name: ${opp.name}`);
      console.log(`   Protocol: ${opp.protocol}`);
      console.log(`   Type: ${opp.type}`);
      console.log(`   APY: ${opp.apy.toFixed(2)}%`);
      console.log(`   TVL: $${opp.tvlUsd.toLocaleString()}`);
      console.log(`   sBTC Amount: ${opp.sbtcAmount.toFixed(4)} sBTC`);
      console.log(`   Risk Level: ${opp.riskLevel}`);
      console.log(`   Risk Score: ${opp.riskScore}/10`);
      console.log(`   IL Risk: ${opp.impermanentLossRisk ? 'Yes' : 'No'}`);
      console.log(`   Min Deposit: ${opp.minDeposit / 100_000_000} sBTC`);
      console.log(`   Lock Period: ${opp.lockPeriod} days`);
      console.log(`   Fees: ${opp.fees.deposit}% deposit, ${opp.fees.withdrawal}% withdrawal`);
      console.log(`   Contract: ${opp.contractAddress}`);
      console.log(`   Description: ${opp.description}`);
      
      if (opp.riskFactors && opp.riskFactors.length > 0) {
        console.log(`   Risk Factors:`);
        opp.riskFactors.forEach(risk => console.log(`     - ${risk}`));
      }
    });

    // Test 3: Data Validation
    console.log('\n3️⃣ Validating Data Quality...');
    
    let validationPassed = true;
    
    opportunities.forEach((opp, index) => {
      // Check required fields
      if (!opp.id || !opp.name || !opp.contractAddress) {
        console.error(`❌ Opportunity ${index + 1}: Missing required fields`);
        validationPassed = false;
      }
      
      // Check APY range
      if (opp.apy < 0 || opp.apy > 1000) {
        console.error(`❌ Opportunity ${index + 1}: Invalid APY: ${opp.apy}%`);
        validationPassed = false;
      }
      
      // Check TVL
      if (opp.tvlUsd < 0) {
        console.error(`❌ Opportunity ${index + 1}: Invalid TVL: $${opp.tvlUsd}`);
        validationPassed = false;
      }
      
      // Check risk score
      if (opp.riskScore < 1 || opp.riskScore > 10) {
        console.error(`❌ Opportunity ${index + 1}: Invalid risk score: ${opp.riskScore}`);
        validationPassed = false;
      }
      
      // Check timestamp freshness (should be recent)
      const ageMinutes = (Date.now() - opp.lastUpdated) / (1000 * 60);
      if (ageMinutes > 5) {
        console.warn(`⚠️ Opportunity ${index + 1}: Data is ${ageMinutes.toFixed(1)} minutes old`);
      }
    });
    
    if (validationPassed) {
      console.log('✅ All data validation checks passed');
    } else {
      console.error('❌ Some data validation checks failed');
    }

    // Test 4: Performance Metrics
    console.log('\n4️⃣ Performance Metrics...');
    
    const totalTVL = opportunities.reduce((sum, opp) => sum + opp.tvlUsd, 0);
    const avgAPY = opportunities.reduce((sum, opp) => sum + opp.apy, 0) / opportunities.length;
    const highRiskCount = opportunities.filter(opp => opp.riskLevel === 'high').length;
    const mediumRiskCount = opportunities.filter(opp => opp.riskLevel === 'medium').length;
    const lowRiskCount = opportunities.filter(opp => opp.riskLevel === 'low').length;
    
    console.log(`📈 Total sBTC TVL: $${totalTVL.toLocaleString()}`);
    console.log(`📊 Average APY: ${avgAPY.toFixed(2)}%`);
    console.log(`🔴 High Risk: ${highRiskCount} opportunities`);
    console.log(`🟡 Medium Risk: ${mediumRiskCount} opportunities`);
    console.log(`🟢 Low Risk: ${lowRiskCount} opportunities`);

    console.log('\n🎉 Velar sBTC Integration Test Completed Successfully!');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    
    if (error instanceof Error) {
      console.error('Error Details:', {
        message: error.message,
        stack: error.stack,
      });
    }
  }
}

// Run the test
testVelarIntegration().catch(console.error);
