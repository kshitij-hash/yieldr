import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const vault = accounts.get("wallet_1")!; // Simulating vault contract
const user1 = accounts.get("wallet_2")!;
const user2 = accounts.get("wallet_3")!;

/*
 * Simulated ALEX Pool Contract Tests
 *
 * This contract simulates an ALEX STX-sBTC pool on testnet for user experience testing.
 * It accepts sBTC deposits, tracks positions, and calculates yield based on mainnet APY data.
 */

describe("simulated-alex-pool", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("initialization", () => {
    it("should initialize with zero TVL", () => {
      const { result } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-total-tvl",
        [],
        deployer
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("should initialize with deployer as owner", () => {
      const { result } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-owner",
        [],
        deployer
      );
      expect(result).toBeOk(Cl.principal(deployer));
    });

    it("should initialize as not paused", () => {
      const { result } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "is-paused",
        [],
        deployer
      );
      expect(result).toBeOk(Cl.bool(false));
    });
  });

  describe("deposit functionality", () => {
    it("should allow deposits and track balance", () => {
      const depositAmount = 1000000; // 0.01 sBTC

      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(depositAmount)],
        vault
      );
      expect(result).toBeOk(Cl.bool(true));

      // Check balance
      const { result: balance } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-balance",
        [Cl.principal(vault)],
        deployer
      );
      expect(balance).toBeOk(Cl.uint(depositAmount));
    });

    it("should update TVL after deposit", () => {
      const depositAmount = 5000000;

      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(depositAmount)],
        vault
      );

      const { result: tvl } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-total-tvl",
        [],
        deployer
      );
      expect(tvl).toBeOk(Cl.uint(depositAmount));
    });

    it("should reject zero amount deposits", () => {
      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(0)],
        vault
      );
      expect(result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("should reject deposits when paused", () => {
      // Pause the pool
      simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(true)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(1000000)],
        vault
      );
      expect(result).toBeErr(Cl.uint(104)); // err-contract-paused

      // Unpause for other tests
      simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(false)],
        deployer
      );
    });

    it("should handle multiple deposits from same user", () => {
      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(1000000)],
        vault
      );

      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(2000000)],
        vault
      );

      const { result: balance } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-balance",
        [Cl.principal(vault)],
        deployer
      );
      expect(balance).toBeOk(Cl.uint(3000000));
    });

    it("should record deposit timestamp", () => {
      const blockHeight = simnet.blockHeight;

      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(1000000)],
        vault
      );

      const { result } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-deposit-height",
        [Cl.principal(vault)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(blockHeight + 1));
    });
  });

  describe("withdrawal functionality", () => {
    beforeEach(() => {
      // Setup: deposit some funds
      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(5000000)],
        vault
      );
    });

    it("should allow withdrawals and update balance", () => {
      const withdrawAmount = 2000000;

      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(withdrawAmount)],
        vault
      );
      expect(result).toBeOk(Cl.bool(true));

      // Check remaining balance
      const { result: balance } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-balance",
        [Cl.principal(vault)],
        deployer
      );
      expect(balance).toBeOk(Cl.uint(3000000));
    });

    it("should update TVL after withdrawal", () => {
      const withdrawAmount = 1000000;

      simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(withdrawAmount)],
        vault
      );

      const { result: tvl } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-total-tvl",
        [],
        deployer
      );
      expect(tvl).toBeOk(Cl.uint(4000000)); // 5000000 - 1000000
    });

    it("should reject withdrawal exceeding balance", () => {
      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(10000000)], // More than deposited
        vault
      );
      expect(result).toBeErr(Cl.uint(101)); // err-insufficient-balance
    });

    it("should reject zero amount withdrawals", () => {
      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(0)],
        vault
      );
      expect(result).toBeErr(Cl.uint(102)); // err-invalid-amount
    });

    it("should reject withdrawals when paused", () => {
      simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(true)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(1000000)],
        vault
      );
      expect(result).toBeErr(Cl.uint(104)); // err-contract-paused

      simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(false)],
        deployer
      );
    });

    it("should allow full withdrawal", () => {
      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(5000000)], // Full amount
        vault
      );
      expect(result).toBeOk(Cl.bool(true));

      const { result: balance } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-balance",
        [Cl.principal(vault)],
        deployer
      );
      expect(balance).toBeOk(Cl.uint(0));
    });
  });

  describe("yield calculation", () => {
    beforeEach(() => {
      // Set APY in oracle (12.50% = 1250 basis points)
      simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(deployer), Cl.bool(true)],
        deployer
      );

      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        deployer
      );

      // Deposit funds
      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(100000000)], // 1 sBTC
        vault
      );
    });

    it("should calculate yield based on time elapsed and APY", () => {
      const depositHeight = simnet.blockHeight;

      // Mine 52560 blocks (approximately 1 year at ~10 min/block)
      for (let i = 0; i < 100; i++) {
        simnet.mineEmptyBlock();
      }

      const { result } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-accrued-yield",
        [Cl.principal(vault)],
        deployer
      );

      // Should have some yield (exact calculation depends on implementation)
      // With 12.50% APY and 100 blocks, expect some positive yield
      expect(result.type).toBe("ok");

      const yieldAmount = (result as any).value.value;
      expect(Number(yieldAmount)).toBeGreaterThan(0);
    });

    it("should return zero yield for user with no deposit", () => {
      const { result } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-accrued-yield",
        [Cl.principal(user1)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("should calculate yield proportional to deposit amount", () => {
      // Deposit different amounts for two users
      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(100000000)], // 1 sBTC
        user1
      );

      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(200000000)], // 2 sBTC
        user2
      );

      // Mine blocks
      for (let i = 0; i < 100; i++) {
        simnet.mineEmptyBlock();
      }

      const { result: yield1 } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-accrued-yield",
        [Cl.principal(user1)],
        deployer
      );

      const { result: yield2 } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-accrued-yield",
        [Cl.principal(user2)],
        deployer
      );

      const yield1Amount = Number((yield1 as any).value.value);
      const yield2Amount = Number((yield2 as any).value.value);

      // User2's yield should be approximately 2x user1's yield
      expect(yield2Amount).toBeGreaterThan(yield1Amount);
      expect(yield2Amount / yield1Amount).toBeCloseTo(2, 0); // Within 1 decimal place
    });
  });

  describe("admin functions", () => {
    it("should allow owner to pause/unpause", () => {
      let result = simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(true)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      let { result: paused } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "is-paused",
        [],
        deployer
      );
      expect(paused).toBeOk(Cl.bool(true));

      result = simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(false)],
        deployer
      );
      expect(result.result).toBeOk(Cl.bool(true));

      paused = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "is-paused",
        [],
        deployer
      ).result;
      expect(paused).toBeOk(Cl.bool(false));
    });

    it("should reject pause from non-owner", () => {
      const { result } = simnet.callPublicFn(
        "simulated-alex-pool",
        "set-paused",
        [Cl.bool(true)],
        user1
      );
      expect(result).toBeErr(Cl.uint(100)); // err-not-authorized
    });
  });

  describe("edge cases", () => {
    it("should handle deposits from multiple users independently", () => {
      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(1000000)],
        user1
      );

      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(2000000)],
        user2
      );

      const { result: balance1 } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-balance",
        [Cl.principal(user1)],
        deployer
      );
      expect(balance1).toBeOk(Cl.uint(1000000));

      const { result: balance2 } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-balance",
        [Cl.principal(user2)],
        deployer
      );
      expect(balance2).toBeOk(Cl.uint(2000000));
    });

    it("should maintain accurate TVL across multiple operations", () => {
      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(1000000)],
        user1
      );

      simnet.callPublicFn(
        "simulated-alex-pool",
        "deposit",
        [Cl.uint(2000000)],
        user2
      );

      simnet.callPublicFn(
        "simulated-alex-pool",
        "withdraw",
        [Cl.uint(500000)],
        user1
      );

      const { result: tvl } = simnet.callReadOnlyFn(
        "simulated-alex-pool",
        "get-total-tvl",
        [],
        deployer
      );
      expect(tvl).toBeOk(Cl.uint(2500000)); // 1000000 + 2000000 - 500000
    });
  });
});
