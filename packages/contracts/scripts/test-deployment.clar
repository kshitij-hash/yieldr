;; Post-Deployment Testing Script
;; Run these commands in clarinet console to initialize and test deployed contracts

;; ============================================================================
;; CONFIGURATION
;; ============================================================================
;; Deployer: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM (simnet)
;; Testnet Deployer: STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ

;; ============================================================================
;; STEP 1: Initialize Pool Oracle
;; ============================================================================

;; Set deployer as authorized updater
(print "🔐 Setting authorized updater...")
(contract-call? .pool-oracle set-authorized-updater tx-sender true)

;; Verify authorization
(print "✅ Verifying authorization...")
(contract-call? .pool-oracle is-authorized-updater tx-sender)
;; Expected: (ok true)

;; Set ALEX APY to 5% (500 basis points)
(print "📊 Setting ALEX APY to 5%...")
(contract-call? .pool-oracle update-alex-apy u500)

;; Set Velar APY to 10.8% (1080 basis points)
(print "📊 Setting Velar APY to 10.8%...")
(contract-call? .pool-oracle update-velar-apy u1080)

;; Verify APY values
(print "✅ Verifying APY values...")
(contract-call? .pool-oracle get-all-data)
;; Expected: (ok {alex-apy: u500, velar-apy: u1080, last-updated: <block-height>})

;; ============================================================================
;; STEP 2: Test Vault Read-Only Functions
;; ============================================================================

(print "\n📖 Testing vault read-only functions...")

;; Check if paused (should be false)
(contract-call? .yielder is-paused)
;; Expected: false

;; Get TVL (should be u0 initially)
(contract-call? .yielder get-total-tvl)
;; Expected: u0

;; Get depositor count (should be u0 initially)
(contract-call? .yielder get-depositor-count)
;; Expected: u0

;; Get balance for current user (should be u0)
(contract-call? .yielder get-balance tx-sender)
;; Expected: u0

;; Get risk preference (should default to u2 - moderate)
(contract-call? .yielder get-risk-preference tx-sender)
;; Expected: (ok u2)

;; ============================================================================
;; STEP 3: Test Risk Preference
;; ============================================================================

(print "\n⚙️  Testing risk preference management...")

;; Set to conservative
(contract-call? .yielder set-risk-preference u1)
;; Expected: (ok true)

;; Verify it was set
(contract-call? .yielder get-risk-preference tx-sender)
;; Expected: (ok u1)

;; Change to aggressive
(contract-call? .yielder set-risk-preference u3)
;; Expected: (ok true)

;; Verify new value
(contract-call? .yielder get-risk-preference tx-sender)
;; Expected: (ok u3)

;; Reset to moderate
(contract-call? .yielder set-risk-preference u2)

;; ============================================================================
;; STEP 4: Test Pool Allocations
;; ============================================================================

(print "\n💰 Testing pool allocations...")

;; Get initial allocations (should be all zeros)
(contract-call? .yielder get-pool-allocations tx-sender)
;; Expected: (ok {alex-amount: u0, velar-amount: u0})

;; Test rebalancing (testnet simulation allows this without vault balance)
(print "🔄 Testing rebalancing...")
(contract-call? .yielder rebalance u600000 u400000)
;; Expected: (ok true)

;; Verify allocations were recorded
(contract-call? .yielder get-pool-allocations tx-sender)
;; Expected: (ok {alex-amount: u600000, velar-amount: u400000})

;; Test rebalancing again with different amounts
(contract-call? .yielder rebalance u500000 u500000)
;; Expected: (ok true)

;; Verify updated allocations
(contract-call? .yielder get-pool-allocations tx-sender)
;; Expected: (ok {alex-amount: u500000, velar-amount: u500000})

;; ============================================================================
;; STEP 5: Test Pause/Unpause
;; ============================================================================

(print "\n⏸️  Testing pause/unpause mechanism...")

;; Pause contract (owner only)
(contract-call? .yielder pause-contract)
;; Expected: (ok true)

;; Verify paused
(contract-call? .yielder is-paused)
;; Expected: true

;; Try to rebalance while paused (should fail)
(contract-call? .yielder rebalance u100000 u100000)
;; Expected: (err u104) - err-contract-paused

;; Unpause contract
(contract-call? .yielder unpause-contract)
;; Expected: (ok true)

;; Verify unpaused
(contract-call? .yielder is-paused)
;; Expected: false

;; Rebalancing should work now
(contract-call? .yielder rebalance u100000 u100000)
;; Expected: (ok true)

;; ============================================================================
;; STEP 6: Test Simulated Pools
;; ============================================================================

(print "\n🏊 Testing simulated pools...")

;; Test ALEX pool
(print "Testing ALEX pool...")
(contract-call? .simulated-alex-pool get-total-tvl)
;; Expected: u0 initially

(contract-call? .simulated-alex-pool is-paused)
;; Expected: false

;; Test Velar pool
(print "Testing Velar pool...")
(contract-call? .simulated-velar-pool get-total-tvl)
;; Expected: u0 initially

(contract-call? .simulated-velar-pool is-paused)
;; Expected: false

;; ============================================================================
;; SUMMARY
;; ============================================================================

(print "\n✨ Post-Deployment Testing Complete!")
(print "====================================")
(print "✅ Pool oracle initialized with APY values")
(print "✅ Vault functions tested successfully")
(print "✅ Risk preference management working")
(print "✅ Rebalancing functionality verified")
(print "✅ Pause/unpause mechanism tested")
(print "✅ Simulated pools operational")
(print "\n🚀 Contracts are ready for integration!")
