/**
 * Post-Deployment Initialization Script
 *
 * This script initializes the BitYield contracts after deployment:
 * 1. Set pool oracle authorized updaters
 * 2. Initialize APY values (ALEX: 5%, Velar: 10.8%)
 * 3. Verify all contract interactions
 * 4. Test basic deposit/withdrawal flow
 */

import { Cl } from "@stacks/transactions";

// Deployment configuration
const DEPLOYER_ADDRESS = "STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ";
const CONTRACTS = {
  poolOracle: `${DEPLOYER_ADDRESS}.pool-oracle`,
  alexPool: `${DEPLOYER_ADDRESS}.simulated-alex-pool`,
  velarPool: `${DEPLOYER_ADDRESS}.simulated-velar-pool`,
  vault: `${DEPLOYER_ADDRESS}.yielder`
};

// APY values in basis points (100 = 1%)
const APY_VALUES = {
  alex: 500,    // 5%
  velar: 1080   // 10.8%
};

console.log("🚀 BitYield Post-Deployment Initialization");
console.log("==========================================\n");

console.log("📋 Deployment Configuration:");
console.log(`   Deployer: ${DEPLOYER_ADDRESS}`);
console.log(`   Pool Oracle: ${CONTRACTS.poolOracle}`);
console.log(`   ALEX Pool: ${CONTRACTS.alexPool}`);
console.log(`   Velar Pool: ${CONTRACTS.velarPool}`);
console.log(`   Vault: ${CONTRACTS.vault}\n`);

// Step 1: Initialize Pool Oracle
console.log("📊 Step 1: Initializing Pool Oracle");
console.log("------------------------------------");

// Commands to run in Clarinet console:
const initCommands = `
;; Step 1a: Set deployer as authorized updater
(contract-call? '${CONTRACTS.poolOracle} set-authorized-updater '${DEPLOYER_ADDRESS} true)

;; Step 1b: Set ALEX APY to 5% (500 basis points)
(contract-call? '${CONTRACTS.poolOracle} update-alex-apy u${APY_VALUES.alex})

;; Step 1c: Set Velar APY to 10.8% (1080 basis points)
(contract-call? '${CONTRACTS.poolOracle} update-velar-apy u${APY_VALUES.velar})

;; Step 1d: Verify oracle data
(contract-call? '${CONTRACTS.poolOracle} get-all-data)
`;

console.log("Run these commands in Clarinet console:");
console.log(initCommands);

// Step 2: Verify Contract Interactions
console.log("\n✅ Step 2: Verify Contract Interactions");
console.log("----------------------------------------");

const verifyCommands = `
;; Check oracle authorization
(contract-call? '${CONTRACTS.poolOracle} is-authorized-updater '${DEPLOYER_ADDRESS})

;; Get ALEX APY (should be u500)
(contract-call? '${CONTRACTS.poolOracle} get-alex-apy)

;; Get Velar APY (should be u1080)
(contract-call? '${CONTRACTS.poolOracle} get-velar-apy)

;; Check vault status
(contract-call? '${CONTRACTS.vault} is-paused)
(contract-call? '${CONTRACTS.vault} get-total-tvl)
(contract-call? '${CONTRACTS.vault} get-depositor-count)
`;

console.log("Verification commands:");
console.log(verifyCommands);

// Step 3: Test Basic Operations
console.log("\n🧪 Step 3: Test Basic Operations (Optional)");
console.log("--------------------------------------------");

const testCommands = `
;; Test 1: Set risk preference
(contract-call? '${CONTRACTS.vault} set-risk-preference u2)

;; Test 2: Check risk preference
(contract-call? '${CONTRACTS.vault} get-risk-preference tx-sender)

;; Test 3: Get balance (should be u0 for new user)
(contract-call? '${CONTRACTS.vault} get-balance tx-sender)

;; Test 4: Test pause/unpause (owner only)
(contract-call? '${CONTRACTS.vault} pause-contract)
(contract-call? '${CONTRACTS.vault} is-paused)
(contract-call? '${CONTRACTS.vault} unpause-contract)
(contract-call? '${CONTRACTS.vault} is-paused)
`;

console.log("Test commands:");
console.log(testCommands);

// Summary
console.log("\n📝 Summary");
console.log("----------");
console.log("1. Initialize pool oracle with authorized updater and APY values");
console.log("2. Verify all read-only functions return expected values");
console.log("3. Test basic operations to ensure contracts are working");
console.log("\n✨ After initialization, the contracts will be ready for use!");

// Export configuration for other scripts
export const POST_DEPLOYMENT_CONFIG = {
  network: "testnet",
  deployer: DEPLOYER_ADDRESS,
  contracts: CONTRACTS,
  apyValues: APY_VALUES
};
