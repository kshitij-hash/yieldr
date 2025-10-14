import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// Get all test accounts
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("BitYield Vault Contract", () => {

  // =============================================================================
  // PHASE 3: Read-Only Functions Tests
  // =============================================================================

  describe("Read-Only Functions", () => {

    it("get-balance returns u0 for address that never deposited", () => {
      const result = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result.result).toBeUint(0);
    });

    it("get-total-tvl returns u0 initially", () => {
      const result = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-total-tvl",
        [],
        deployer
      );
      expect(result.result).toBeUint(0);
    });

    it("get-deposit-timestamp returns u0 for address that never deposited", () => {
      const result = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-deposit-timestamp",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result.result).toBeUint(0);
    });

    it("is-paused returns false initially", () => {
      const result = simnet.callReadOnlyFn(
        "bityield-vault",
        "is-paused",
        [],
        deployer
      );
      expect(result.result).toBeBool(false);
    });

    it("get-depositor-count returns u0 initially", () => {
      const result = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      expect(result.result).toBeUint(0);
    });

  });

  // =============================================================================
  // PHASE 4: Deposit Function Tests
  // =============================================================================

  describe("Deposit Function", () => {

    it("rejects zero amount deposit", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects deposit below minimum", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(50000)], // Below min-deposit of 100000
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects deposit above maximum", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(200000000000)], // Above max-deposit of 100000000000
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects deposit when contract is paused", () => {
      // First pause the contract
      simnet.callPublicFn(
        "bityield-vault",
        "pause-contract",
        [],
        deployer
      );

      // Then try to deposit
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(104)); // err-contract-paused

      // Unpause for subsequent tests
      simnet.callPublicFn(
        "bityield-vault",
        "unpause-contract",
        [],
        deployer
      );
    });

    // Note: The following tests will need a mock sBTC contract for full integration
    // For now, we'll test the validation logic and state updates

    it("accepts valid deposit amount (validation only)", () => {
      const amount = 1000000; // 1 sBTC
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(amount)],
        wallet1
      );
      // This will fail at token transfer stage without sBTC contract
      // But it should pass validation checks first
      // We expect either success or transfer-failed error, not validation errors
      const isValidationPassed = result.result.type === 'ok' ||
                                  (result.result.type === 'error' &&
                                   result.result.value !== Cl.uint(102) &&
                                   result.result.value !== Cl.uint(104));
      expect(isValidationPassed).toBe(true);
    });

  });

  // =============================================================================
  // PHASE 5: Withdrawal Function Tests
  // =============================================================================

  describe("Withdrawal Function", () => {

    it("rejects withdrawal when no balance exists", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(100000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });

    it("rejects withdrawal exceeding balance", () => {
      // First deposit
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      // Try to withdraw more than deposited
      const result = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(2000000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });

    it("rejects zero amount withdrawal", () => {
      // First deposit
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      // Try to withdraw zero
      const result = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects withdrawal when contract is paused", () => {
      // First deposit
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      // Pause contract
      simnet.callPublicFn(
        "bityield-vault",
        "pause-contract",
        [],
        deployer
      );

      // Try to withdraw
      const result = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(500000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(104)); // err-contract-paused

      // Unpause for subsequent tests
      simnet.callPublicFn(
        "bityield-vault",
        "unpause-contract",
        [],
        deployer
      );
    });

    it("allows partial withdrawal with correct balance updates", () => {
      const depositAmount = 1000000;
      const withdrawAmount = 400000;

      // Deposit
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(depositAmount)],
        wallet2
      );

      // Withdraw partial amount
      const withdrawResult = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(withdrawAmount)],
        wallet2
      );
      expect(withdrawResult.result).toBeOk(Cl.uint(withdrawAmount));

      // Check updated balance
      const balanceResult = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(balanceResult.result).toBeUint(depositAmount - withdrawAmount);

      // Check TVL decreased
      const tvlResult = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-total-tvl",
        [],
        deployer
      );
      // TVL should reflect the net deposit across all tests
      expect(tvlResult.result).toBeUint(depositAmount - withdrawAmount);
    });

    it("allows full withdrawal with balance becoming zero", () => {
      const depositAmount = 2000000;

      // Deposit
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(depositAmount)],
        wallet3
      );

      // Withdraw full amount
      const withdrawResult = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(depositAmount)],
        wallet3
      );
      expect(withdrawResult.result).toBeOk(Cl.uint(depositAmount));

      // Check balance is zero
      const balanceResult = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(balanceResult.result).toBeUint(0);
    });

    it("records withdrawal timestamp", () => {
      const depositAmount = 500000;

      // Deposit
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(depositAmount)],
        wallet1
      );

      // Get block height before withdrawal
      const blockHeightBefore = simnet.blockHeight;

      // Withdraw
      simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(depositAmount)],
        wallet1
      );

      // Check withdrawal timestamp was recorded
      const timestampResult = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-withdrawal-timestamp",
        [Cl.principal(wallet1)],
        deployer
      );

      // Timestamp should be greater than or equal to the block height before withdrawal
      expect(Number(timestampResult.result.value)).toBeGreaterThanOrEqual(blockHeightBefore);
    });

  });

  // =============================================================================
  // PHASE 7: Advanced Features - Deposit For
  // =============================================================================

  describe("Deposit For Function", () => {

    it("allows deposit-for to another user", () => {
      const depositAmount = 1500000;

      // wallet1 deposits for wallet2
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet2), Cl.uint(depositAmount)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(depositAmount));

      // Check wallet2's balance increased (not wallet1)
      const wallet2Balance = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(wallet2Balance.result).toBeUint(depositAmount);

      // Check wallet1's balance didn't change
      const wallet1Balance = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(wallet1Balance.result).toBeUint(0);
    });

    it("rejects deposit-for with zero amount", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(0)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects deposit-for below minimum", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(50000)], // Below 100000 minimum
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects deposit-for above maximum", () => {
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(200000000000)], // Above max
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("rejects deposit-for when contract is paused", () => {
      // Pause contract
      simnet.callPublicFn(
        "bityield-vault",
        "pause-contract",
        [],
        deployer
      );

      // Try deposit-for
      const result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(500000)],
        wallet1
      );
      expect(result.result).toBeErr(Cl.uint(104)); // err-contract-paused

      // Unpause
      simnet.callPublicFn(
        "bityield-vault",
        "unpause-contract",
        [],
        deployer
      );
    });

    it("increments depositor count for first deposit-for", () => {
      const initialCount = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      const initialCountValue = Number(initialCount.result.value);

      // wallet1 deposits for a fresh wallet (wallet3)
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(500000)],
        wallet1
      );

      const newCount = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      const newCountValue = Number(newCount.result.value);

      expect(newCountValue).toBe(initialCountValue + 1);
    });

    it("records deposit timestamp for recipient", () => {
      const blockHeightBefore = simnet.blockHeight;

      // wallet1 deposits for wallet3
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(600000)],
        wallet1
      );

      // Check wallet3's deposit timestamp
      const timestamp = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-deposit-timestamp",
        [Cl.principal(wallet3)],
        deployer
      );

      expect(Number(timestamp.result.value)).toBeGreaterThanOrEqual(blockHeightBefore);
    });

  });

  // =============================================================================
  // PHASE 9: Integration Tests
  // =============================================================================

  describe("Integration Tests - End-to-End Flows", () => {

    it("complete user journey: deposit, partial withdraw, deposit again, full withdraw", () => {
      const user = wallet1;

      // Step 1: Initial deposit
      const deposit1 = 2000000;
      let result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(deposit1)],
        user
      );
      expect(result.result).toBeOk(Cl.uint(deposit1));

      // Verify balance
      let balance = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(user)],
        deployer
      );
      expect(balance.result).toBeUint(deposit1);

      // Step 2: Partial withdrawal
      const withdraw1 = 500000;
      result = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(withdraw1)],
        user
      );
      expect(result.result).toBeOk(Cl.uint(withdraw1));

      // Verify balance decreased
      balance = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(user)],
        deployer
      );
      expect(balance.result).toBeUint(deposit1 - withdraw1);

      // Step 3: Second deposit
      const deposit2 = 1000000;
      result = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(deposit2)],
        user
      );
      expect(result.result).toBeOk(Cl.uint(deposit2));

      // Verify cumulative balance
      balance = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(user)],
        deployer
      );
      expect(balance.result).toBeUint(deposit1 - withdraw1 + deposit2);

      // Step 4: Full withdrawal
      const finalBalance = deposit1 - withdraw1 + deposit2;
      result = simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(finalBalance)],
        user
      );
      expect(result.result).toBeOk(Cl.uint(finalBalance));

      // Verify balance is zero
      balance = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(user)],
        deployer
      );
      expect(balance.result).toBeUint(0);
    });

    it("multiple users with concurrent operations maintain correct balances", () => {
      // User 1 deposits
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      // User 2 deposits
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(2000000)],
        wallet2
      );

      // User 3 deposits
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(3000000)],
        wallet3
      );

      // User 1 withdraws half
      simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(500000)],
        wallet1
      );

      // User 2 deposits more
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet2
      );

      // Verify each user's balance is independent
      const balance1 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(balance1.result).toBeUint(500000);

      const balance2 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(balance2.result).toBeUint(3000000);

      const balance3 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(balance3.result).toBeUint(3000000);

      // Verify TVL is sum of all balances
      const tvl = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-total-tvl",
        [],
        deployer
      );
      expect(tvl.result).toBeUint(500000 + 3000000 + 3000000);
    });

    it("deposit-for and regular deposit maintain correct balances", () => {
      // User 1 deposits for themselves
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      // User 2 deposits for User 3
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(2000000)],
        wallet2
      );

      // User 1 deposits for User 3 again
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(500000)],
        wallet1
      );

      // Verify balances
      const balance1 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(balance1.result).toBeUint(1000000); // Only their own deposit

      const balance2 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(balance2.result).toBeUint(0); // They deposited for someone else

      const balance3 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(balance3.result).toBeUint(2500000); // Received deposits from wallet2 and wallet1
    });

    it("pause/unpause cycle maintains data integrity", () => {
      // Initial deposits
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      // Pause
      simnet.callPublicFn(
        "bityield-vault",
        "pause-contract",
        [],
        deployer
      );

      // Verify paused
      const isPaused1 = simnet.callReadOnlyFn(
        "bityield-vault",
        "is-paused",
        [],
        deployer
      );
      expect(isPaused1.result).toBeBool(true);

      // Try to deposit while paused (should fail)
      const failedDeposit = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(500000)],
        wallet2
      );
      expect(failedDeposit.result).toBeErr(Cl.uint(104));

      // Unpause
      simnet.callPublicFn(
        "bityield-vault",
        "unpause-contract",
        [],
        deployer
      );

      // Verify unpaused
      const isPaused2 = simnet.callReadOnlyFn(
        "bityield-vault",
        "is-paused",
        [],
        deployer
      );
      expect(isPaused2.result).toBeBool(false);

      // Deposit should work now
      const successfulDeposit = simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(500000)],
        wallet2
      );
      expect(successfulDeposit.result).toBeOk(Cl.uint(500000));

      // Verify original balance still intact
      const balance1 = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-balance",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(balance1.result).toBeUint(1000000);
    });

    it("TVL accurately reflects multiple concurrent operations", () => {
      // Get initial TVL
      let tvl = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-total-tvl",
        [],
        deployer
      );
      const initialTVL = Number(tvl.result.value);

      // Multiple deposits
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(2000000)],
        wallet2
      );
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet3), Cl.uint(3000000)],
        wallet1
      );

      // Check TVL increased correctly
      tvl = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-total-tvl",
        [],
        deployer
      );
      expect(tvl.result).toBeUint(initialTVL + 6000000);

      // Multiple withdrawals
      simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(500000)],
        wallet1
      );
      simnet.callPublicFn(
        "bityield-vault",
        "withdraw-sbtc",
        [Cl.uint(1000000)],
        wallet2
      );

      // Check TVL decreased correctly
      tvl = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-total-tvl",
        [],
        deployer
      );
      expect(tvl.result).toBeUint(initialTVL + 6000000 - 1500000);
    });

    it("depositor count increments correctly with mixed operations", () => {
      // Get initial count
      let count = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      const initialCount = Number(count.result.value);

      // New user deposits (should increment)
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(1000000)],
        wallet1
      );

      count = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      expect(Number(count.result.value)).toBe(initialCount + 1);

      // Same user deposits again (should NOT increment)
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-sbtc",
        [Cl.uint(500000)],
        wallet1
      );

      count = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      expect(Number(count.result.value)).toBe(initialCount + 1);

      // deposit-for new user (should increment)
      simnet.callPublicFn(
        "bityield-vault",
        "deposit-for",
        [Cl.principal(wallet2), Cl.uint(1000000)],
        wallet1
      );

      count = simnet.callReadOnlyFn(
        "bityield-vault",
        "get-depositor-count",
        [],
        deployer
      );
      expect(Number(count.result.value)).toBe(initialCount + 2);
    });

  });

});
