import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

/*
 * Pool Oracle Contract Tests
 *
 * This contract stores APY data for simulated pools (ALEX and Velar)
 * synchronized from mainnet. Only authorized updaters can modify data.
 */

describe("pool-oracle", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("initialization", () => {
    it("should initialize with deployer as authorized updater", () => {
      const { result } = simnet.callReadOnlyFn(
        "pool-oracle",
        "is-authorized-updater",
        [Cl.principal(deployer)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should initialize with zero APY values", () => {
      const { result: alexAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      expect(alexAPY).toBeOk(Cl.uint(0));

      const { result: velarAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-velar-apy",
        [],
        deployer
      );
      expect(velarAPY).toBeOk(Cl.uint(0));
    });

    it("should have zero last-updated timestamps initially", () => {
      const { result } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-last-updated",
        [],
        deployer
      );
      expect(result).toBeOk(
        Cl.tuple({
          "alex-updated": Cl.uint(0),
          "velar-updated": Cl.uint(0),
        })
      );
    });
  });

  describe("authorization management", () => {
    it("should allow deployer to add new authorized updater", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(true)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify wallet1 is now authorized
      const { result: isAuth } = simnet.callReadOnlyFn(
        "pool-oracle",
        "is-authorized-updater",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(isAuth).toBeOk(Cl.bool(true));
    });

    it("should allow deployer to remove authorized updater", () => {
      // First add wallet1
      simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(true)],
        deployer
      );

      // Then remove
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(false)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify wallet1 is no longer authorized
      const { result: isAuth } = simnet.callReadOnlyFn(
        "pool-oracle",
        "is-authorized-updater",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(isAuth).toBeOk(Cl.bool(false));
    });

    it("should reject unauthorized user trying to manage authorization", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet2), Cl.bool(true)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // err-not-authorized
    });

    it("should not allow removing deployer as authorized updater", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(deployer), Cl.bool(false)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(104)); // err-cannot-remove-deployer
    });
  });

  describe("APY updates", () => {
    beforeEach(() => {
      // Add wallet1 as authorized updater for tests
      simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(true)],
        deployer
      );
    });

    it("should allow authorized updater to set ALEX APY", () => {
      const apyValue = 1250; // 12.50% (basis points)
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(apyValue)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify the value was set
      const { result: apy } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      expect(apy).toBeOk(Cl.uint(apyValue));
    });

    it("should allow authorized updater to set Velar APY", () => {
      const apyValue = 1080; // 10.80% (basis points)
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-velar-apy",
        [Cl.uint(apyValue)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify the value was set
      const { result: apy } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-velar-apy",
        [],
        deployer
      );
      expect(apy).toBeOk(Cl.uint(apyValue));
    });

    it("should update timestamp when APY is updated", () => {
      const blockHeight = simnet.blockHeight;

      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-last-updated",
        [],
        deployer
      );

      // Result is (ok {alex-updated: uint, velar-updated: uint})
      expect(result).toBeOk(
        Cl.tuple({
          "alex-updated": Cl.uint(blockHeight + 1),
          "velar-updated": Cl.uint(0),
        })
      );
    });

    it("should allow updating both APYs in sequence", () => {
      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        wallet1
      );

      simnet.callPublicFn(
        "pool-oracle",
        "update-velar-apy",
        [Cl.uint(1080)],
        wallet1
      );

      const { result: alexAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      const { result: velarAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-velar-apy",
        [],
        deployer
      );

      expect(alexAPY).toBeOk(Cl.uint(1250));
      expect(velarAPY).toBeOk(Cl.uint(1080));
    });

    it("should reject unauthorized user trying to update APY", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(100)); // err-not-authorized
    });

    it("should reject APY values above maximum (100%)", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(10001)], // 100.01%
        wallet1
      );
      expect(result).toBeErr(Cl.uint(101)); // err-invalid-apy
    });

    it("should accept APY value at maximum (100%)", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(10000)], // 100.00%
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("should accept zero APY value", () => {
      // Set non-zero first
      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        wallet1
      );

      // Then set to zero
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(0)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));

      const { result: apy } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      expect(apy).toBeOk(Cl.uint(0));
    });
  });

  describe("batch updates", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(true)],
        deployer
      );
    });

    it("should allow updating both APYs in a single transaction", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-both-apys",
        [Cl.uint(1250), Cl.uint(1080)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));

      const { result: alexAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      const { result: velarAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-velar-apy",
        [],
        deployer
      );

      expect(alexAPY).toBeOk(Cl.uint(1250));
      expect(velarAPY).toBeOk(Cl.uint(1080));
    });

    it("should reject batch update if either APY is invalid", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-both-apys",
        [Cl.uint(1250), Cl.uint(10001)], // velar APY too high
        wallet1
      );
      expect(result).toBeErr(Cl.uint(101)); // err-invalid-apy
    });

    it("should reject batch update from unauthorized user", () => {
      const { result } = simnet.callPublicFn(
        "pool-oracle",
        "update-both-apys",
        [Cl.uint(1250), Cl.uint(1080)],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(100)); // err-not-authorized
    });
  });

  describe("edge cases", () => {
    it("should handle multiple consecutive updates correctly", () => {
      simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(true)],
        deployer
      );

      // Update 1
      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1000)],
        wallet1
      );

      // Update 2
      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1500)],
        wallet1
      );

      // Update 3
      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1250)); // Should be the latest value
    });

    it("should maintain independent APY values for ALEX and Velar", () => {
      simnet.callPublicFn(
        "pool-oracle",
        "set-authorized-updater",
        [Cl.principal(wallet1), Cl.bool(true)],
        deployer
      );

      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(1250)],
        wallet1
      );

      simnet.callPublicFn(
        "pool-oracle",
        "update-velar-apy",
        [Cl.uint(2000)],
        wallet1
      );

      // Update ALEX again - should not affect Velar
      simnet.callPublicFn(
        "pool-oracle",
        "update-alex-apy",
        [Cl.uint(800)],
        wallet1
      );

      const { result: alexAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-alex-apy",
        [],
        deployer
      );
      const { result: velarAPY } = simnet.callReadOnlyFn(
        "pool-oracle",
        "get-velar-apy",
        [],
        deployer
      );

      expect(alexAPY).toBeOk(Cl.uint(800));
      expect(velarAPY).toBeOk(Cl.uint(2000)); // Should remain unchanged
    });
  });
});
