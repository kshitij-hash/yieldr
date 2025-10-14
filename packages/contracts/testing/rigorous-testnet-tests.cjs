#!/usr/bin/env node

/**
 * Rigorous Testnet Testing Script
 * Tests all contract functions with actual testnet transactions
 */

const {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  principalCV,
  cvToJSON,
  fetchCallReadOnlyFunction,
  fetchNonce,
  SignedContractCallOptions
} = require('@stacks/transactions');
const { STACKS_TESTNET } = require('@stacks/network');
const { generateWallet, generateSecretKey, getStxAddress } = require('@stacks/wallet-sdk');

// Configuration
const TESTNET_API = 'https://api.testnet.hiro.so';
const DEPLOYER_ADDRESS = 'STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ';
const CONTRACT_NAME = 'bityield-vault';
const FULL_CONTRACT_ID = `${DEPLOYER_ADDRESS}.${CONTRACT_NAME}`;

// OPTION 1: Generate a new test wallet (set to false after first run)
const GENERATE_NEW_WALLET = false;

// OPTION 2: Use your funded wallet's mnemonic
// This is the wallet with address: ST10MF8HR8WJ7H2XMXBYVVEQ92C1BV4X3RZAKP43N
const TEST_MNEMONIC = "gravity pupil lake enjoy use tide project noodle sleep drive gallery hello wet release hospital fire glove bonus swap trash clerk easy jealous saddle";

const network = STACKS_TESTNET;

let senderKey;
let senderAddress;

/**
 * Initialize wallet - either generate new or use provided mnemonic
 */
async function initializeWallet() {
  console.log('🔐 Initializing test wallet...\n');

  if (GENERATE_NEW_WALLET) {
    // Generate a completely new wallet for testing
    console.log('📝 Generating NEW test wallet...\n');
    const newMnemonic = generateSecretKey(256);
    const wallet = await generateWallet({ secretKey: newMnemonic });
    const account = wallet.accounts[0];

    senderKey = account.stxPrivateKey;
    // Use the Stacks Transactions library to get proper testnet address
    const { privateKeyToAddress } = require('@stacks/transactions');
    senderAddress = privateKeyToAddress(senderKey, network);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  NEW WALLET CREATED - SAVE THIS INFORMATION!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📍 Address: ${senderAddress}`);
    console.log(`🔑 Private Key: ${senderKey}`);
    console.log(`📝 Mnemonic: ${newMnemonic}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('⚠️  IMPORTANT: Get testnet STX for this address:');
    console.log(`   https://explorer.hiro.so/sandbox/faucet?chain=testnet`);
    console.log(`   Address: ${senderAddress}\n`);

  } else {
    // Use provided mnemonic
    if (typeof TEST_MNEMONIC === 'undefined') {
      throw new Error('TEST_MNEMONIC is not defined. Set GENERATE_NEW_WALLET=true or provide a mnemonic.');
    }

    const wallet = await generateWallet({ secretKey: TEST_MNEMONIC });
    const account = wallet.accounts[0];
    senderKey = account.stxPrivateKey;
    const { privateKeyToAddress } = require('@stacks/transactions');
    senderAddress = privateKeyToAddress(senderKey, network);

    console.log(`Wallet Address: ${senderAddress}\n`);
  }

  console.log(`Contract: ${FULL_CONTRACT_ID}`);
  console.log(`Network: Testnet\n`);

  return { senderKey, senderAddress };
}

/**
 * Check STX balance
 */
async function checkSTXBalance(address) {
  try {
    const response = await fetch(`${TESTNET_API}/v2/accounts/${address}?proof=0`);
    const data = await response.json();
    const balance = BigInt(data.balance);
    const balanceSTX = Number(balance) / 1_000_000;
    return { balance, balanceSTX, data };
  } catch (error) {
    console.error(`Error checking balance: ${error.message}`);
    return { balance: 0n, balanceSTX: 0, data: null };
  }
}

/**
 * Call a read-only function
 */
async function callReadOnly(functionName, functionArgs = []) {
  try {
    const result = await fetchCallReadOnlyFunction({
      network,
      contractAddress: DEPLOYER_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      senderAddress: senderAddress || DEPLOYER_ADDRESS,
    });
    return cvToJSON(result);
  } catch (error) {
    throw new Error(`Failed to call ${functionName}: ${error.message}`);
  }
}

/**
 * Make a contract call transaction
 */
async function makeTransaction(functionName, functionArgs, options = {}) {
  try {
    console.log(`📤 Preparing transaction: ${functionName}`);

    // Get current nonce
    const nonceResponse = await fetchNonce({ address: senderAddress, network });
    console.log(`   Nonce: ${nonceResponse}`);

    const txOptions = {
      contractAddress: DEPLOYER_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      senderKey,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      nonce: nonceResponse,
      fee: options.fee || 10000n, // 0.01 STX
      ...options
    };

    const transaction = await makeContractCall(txOptions);

    console.log(`📡 Broadcasting transaction...`);
    const broadcastResponse = await broadcastTransaction({ transaction, network });

    if (broadcastResponse.error) {
      throw new Error(broadcastResponse.reason || broadcastResponse.error);
    }

    console.log(`✅ Transaction broadcast successful`);
    console.log(`   TX ID: ${broadcastResponse.txid || broadcastResponse}`);
    console.log(`   Explorer: https://explorer.hiro.so/txid/0x${broadcastResponse.txid || broadcastResponse}?chain=testnet`);

    return broadcastResponse.txid || broadcastResponse;
  } catch (error) {
    console.error(`❌ Transaction failed: ${error.message}`);
    throw error;
  }
}

/**
 * Wait for transaction confirmation
 */
async function waitForTransaction(txid, maxAttempts = 30) {
  console.log(`\n⏳ Waiting for transaction confirmation...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${TESTNET_API}/extended/v1/tx/0x${txid}`);
      const data = await response.json();

      if (data.tx_status === 'success') {
        console.log(`✅ Transaction confirmed in block ${data.block_height}`);
        return { success: true, data };
      } else if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
        console.log(`❌ Transaction failed: ${data.tx_status}`);
        console.log(`   Reason: ${data.tx_result?.repr || 'Unknown'}`);
        return { success: false, data };
      } else if (data.tx_status === 'pending') {
        process.stdout.write('.');
      }
    } catch (error) {
      // Transaction might not be indexed yet
      process.stdout.write('.');
    }

    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  }

  console.log(`\n⚠️  Transaction confirmation timeout`);
  return { success: false, timeout: true };
}

/**
 * Display contract state
 */
async function displayState() {
  console.log('\n📊 Current Contract State:');
  console.log('─────────────────────────────────────');

  try {
    const tvl = await callReadOnly('get-total-tvl');
    const depositors = await callReadOnly('get-depositor-count');
    const paused = await callReadOnly('is-paused');
    const balance = await callReadOnly('get-balance', [principalCV(senderAddress)]);

    console.log(`   TVL: ${tvl.value} sats`);
    console.log(`   Depositors: ${depositors.value}`);
    console.log(`   Paused: ${paused.value}`);
    console.log(`   Your Balance: ${balance.value} sats`);
  } catch (error) {
    console.log(`   Error reading state: ${error.message}`);
  }
  console.log('─────────────────────────────────────\n');
}

/**
 * Test Suite
 */
async function runTests() {
  console.log('==========================================');
  console.log('BitYield Vault - Rigorous Testnet Tests');
  console.log('==========================================\n');
  console.log(`Contract: ${FULL_CONTRACT_ID}`);
  console.log(`Network: Testnet\n`);

  // Initialize wallet
  await initializeWallet();

  // Check balance
  console.log('💰 Checking STX balance...');
  const { balanceSTX } = await checkSTXBalance(senderAddress);
  console.log(`   Balance: ${balanceSTX} STX\n`);

  if (balanceSTX < 1) {
    console.log('⚠️  WARNING: Low STX balance!');
    console.log('   You need testnet STX to pay for transaction fees.');
    console.log('   Get testnet STX from: https://explorer.hiro.so/sandbox/faucet?chain=testnet');
    console.log('   Your address: ' + senderAddress);
    console.log('\n   Continuing with tests anyway...\n');
  }

  // Display initial state
  await displayState();

  let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Test 1: Deposit - Minimum Amount
  console.log('==========================================');
  console.log('Test 1: Deposit Minimum Amount (0.001 sBTC)');
  console.log('==========================================\n');

  try {
    const minDeposit = 100000n; // 0.001 sBTC (100,000 sats)
    console.log(`Amount: ${minDeposit} sats (0.001 sBTC)`);

    const txid = await makeTransaction('deposit-sbtc', [uintCV(minDeposit)]);
    const result = await waitForTransaction(txid);

    if (result.success) {
      console.log('✅ Test 1 PASSED');
      testResults.passed++;
      await displayState();
    } else {
      console.log('❌ Test 1 FAILED');
      testResults.failed++;
    }
  } catch (error) {
    console.log(`❌ Test 1 FAILED: ${error.message}`);
    testResults.failed++;
  }

  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 2: Check Balance After Deposit
  console.log('\n==========================================');
  console.log('Test 2: Verify Balance After Deposit');
  console.log('==========================================\n');

  try {
    const balance = await callReadOnly('get-balance', [principalCV(senderAddress)]);
    console.log(`Your balance: ${balance.value} sats`);

    if (BigInt(balance.value) >= 100000n) {
      console.log('✅ Test 2 PASSED - Balance updated correctly');
      testResults.passed++;
    } else {
      console.log('❌ Test 2 FAILED - Balance not updated');
      testResults.failed++;
    }
  } catch (error) {
    console.log(`❌ Test 2 FAILED: ${error.message}`);
    testResults.failed++;
  }

  // Test 3: Deposit - Larger Amount
  console.log('\n==========================================');
  console.log('Test 3: Deposit Larger Amount (0.1 sBTC)');
  console.log('==========================================\n');

  try {
    const largeDeposit = 10000000n; // 0.1 sBTC (10,000,000 sats)
    console.log(`Amount: ${largeDeposit} sats (0.1 sBTC)`);

    const txid = await makeTransaction('deposit-sbtc', [uintCV(largeDeposit)]);
    const result = await waitForTransaction(txid);

    if (result.success) {
      console.log('✅ Test 3 PASSED');
      testResults.passed++;
      await displayState();
    } else {
      console.log('❌ Test 3 FAILED');
      testResults.failed++;
    }
  } catch (error) {
    console.log(`❌ Test 3 FAILED: ${error.message}`);
    testResults.failed++;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 4: Partial Withdrawal
  console.log('\n==========================================');
  console.log('Test 4: Partial Withdrawal');
  console.log('==========================================\n');

  try {
    const withdrawAmount = 1000000n; // 0.01 sBTC
    console.log(`Amount: ${withdrawAmount} sats (0.01 sBTC)`);

    const balanceBefore = await callReadOnly('get-balance', [principalCV(senderAddress)]);
    console.log(`Balance before: ${balanceBefore.value} sats`);

    if (BigInt(balanceBefore.value) < withdrawAmount) {
      console.log('⚠️  Test 4 SKIPPED - Insufficient balance');
      testResults.skipped++;
    } else {
      const txid = await makeTransaction('withdraw-sbtc', [uintCV(withdrawAmount)]);
      const result = await waitForTransaction(txid);

      if (result.success) {
        console.log('✅ Test 4 PASSED');
        testResults.passed++;
        await displayState();
      } else {
        console.log('❌ Test 4 FAILED');
        testResults.failed++;
      }
    }
  } catch (error) {
    console.log(`❌ Test 4 FAILED: ${error.message}`);
    testResults.failed++;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 5: Deposit-for Another Address
  console.log('\n==========================================');
  console.log('Test 5: Deposit-for Another Address');
  console.log('==========================================\n');

  try {
    // Use wallet_1 address from devnet as recipient
    const recipient = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const amount = 500000n; // 0.005 sBTC

    console.log(`Recipient: ${recipient}`);
    console.log(`Amount: ${amount} sats (0.005 sBTC)`);

    const txid = await makeTransaction('deposit-for', [
      principalCV(recipient),
      uintCV(amount)
    ]);
    const result = await waitForTransaction(txid);

    if (result.success) {
      console.log('✅ Test 5 PASSED');
      testResults.passed++;

      // Check recipient balance
      const recipientBalance = await callReadOnly('get-balance', [principalCV(recipient)]);
      console.log(`Recipient balance: ${recipientBalance.value} sats`);
      await displayState();
    } else {
      console.log('❌ Test 5 FAILED');
      testResults.failed++;
    }
  } catch (error) {
    console.log(`❌ Test 5 FAILED: ${error.message}`);
    testResults.failed++;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 6: Pause Contract (Admin Only)
  console.log('\n==========================================');
  console.log('Test 6: Pause Contract (Admin Function)');
  console.log('==========================================\n');

  try {
    console.log('Attempting to pause contract...');

    const txid = await makeTransaction('pause-contract', []);
    const result = await waitForTransaction(txid);

    if (result.success) {
      const paused = await callReadOnly('is-paused');
      if (paused.value === true) {
        console.log('✅ Test 6 PASSED - Contract paused successfully');
        testResults.passed++;
      } else {
        console.log('❌ Test 6 FAILED - Contract not paused');
        testResults.failed++;
      }
    } else {
      console.log('❌ Test 6 FAILED - Pause transaction failed');
      console.log('   (This is expected if you are not the contract owner)');
      testResults.failed++;
    }
  } catch (error) {
    console.log(`❌ Test 6 FAILED: ${error.message}`);
    testResults.failed++;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 7: Try Deposit While Paused (Should Fail)
  console.log('\n==========================================');
  console.log('Test 7: Deposit While Paused (Should Fail)');
  console.log('==========================================\n');

  try {
    const paused = await callReadOnly('is-paused');

    if (paused.value === false) {
      console.log('⚠️  Test 7 SKIPPED - Contract not paused');
      testResults.skipped++;
    } else {
      console.log('Contract is paused, attempting deposit...');
      const txid = await makeTransaction('deposit-sbtc', [uintCV(100000n)]);
      const result = await waitForTransaction(txid);

      if (!result.success) {
        console.log('✅ Test 7 PASSED - Deposit correctly blocked while paused');
        testResults.passed++;
      } else {
        console.log('❌ Test 7 FAILED - Deposit succeeded while paused (security issue!)');
        testResults.failed++;
      }
    }
  } catch (error) {
    console.log(`✅ Test 7 PASSED - Deposit blocked with error: ${error.message}`);
    testResults.passed++;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 8: Unpause Contract
  console.log('\n==========================================');
  console.log('Test 8: Unpause Contract');
  console.log('==========================================\n');

  try {
    const paused = await callReadOnly('is-paused');

    if (paused.value === false) {
      console.log('⚠️  Test 8 SKIPPED - Contract not paused');
      testResults.skipped++;
    } else {
      console.log('Attempting to unpause contract...');
      const txid = await makeTransaction('unpause-contract', []);
      const result = await waitForTransaction(txid);

      if (result.success) {
        const unpausedCheck = await callReadOnly('is-paused');
        if (unpausedCheck.value === false) {
          console.log('✅ Test 8 PASSED - Contract unpaused successfully');
          testResults.passed++;
        } else {
          console.log('❌ Test 8 FAILED - Contract still paused');
          testResults.failed++;
        }
      } else {
        console.log('❌ Test 8 FAILED - Unpause transaction failed');
        testResults.failed++;
      }
    }
  } catch (error) {
    console.log(`❌ Test 8 FAILED: ${error.message}`);
    testResults.failed++;
  }

  // Final State
  console.log('\n==========================================');
  console.log('Final Contract State');
  console.log('==========================================');
  await displayState();

  // Test Summary
  console.log('\n==========================================');
  console.log('Test Summary');
  console.log('==========================================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⚠️  Skipped: ${testResults.skipped}`);
  console.log(`Total: ${testResults.passed + testResults.failed + testResults.skipped}`);
  console.log('==========================================\n');

  return testResults;
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await runTests();
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main();
}

module.exports = { runTests, initializeWallet, makeTransaction, callReadOnly };
