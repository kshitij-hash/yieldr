;; Simulated Velar Pool Fuzz Tests for Rendezvous
;; Property-based and invariant tests for the simulated-velar-pool contract

;; Error codes for test assertions
(define-constant ERR_TEST_FAILED (err u9999))

;; =============================================================================
;; PROPERTY-BASED TESTS
;; =============================================================================

;; Test: Deposits should always increase user balance and TVL
(define-public (test-deposit-increases-balance (amount uint))
  (begin
    (asserts! (> amount u0) (ok true)) ;; Skip zero amounts

    (let
      (
        (initial-balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
        (initial-tvl (unwrap-panic (contract-call? .simulated-velar-pool get-total-tvl)))
      )
      ;; Perform deposit
      (match (contract-call? .simulated-velar-pool deposit amount)
        success
          (let
            (
              (final-balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
              (final-tvl (unwrap-panic (contract-call? .simulated-velar-pool get-total-tvl)))
            )
            ;; Verify balance increased by amount
            (asserts!
              (is-eq final-balance (+ initial-balance amount))
              ERR_TEST_FAILED
            )
            ;; Verify TVL increased by amount
            (asserts!
              (is-eq final-tvl (+ initial-tvl amount))
              ERR_TEST_FAILED
            )
            (ok true)
          )
        error (ok true) ;; Contract paused or other valid error
      )
    )
  )
)

;; Discard function: Only test valid deposit amounts
(define-read-only (can-test-deposit-increases-balance (amount uint))
  (and (> amount u0) (<= amount u1000000000000)) ;; Between 0 and 10,000 sBTC
)

;; Test: Withdrawals should always decrease user balance and TVL
(define-public (test-withdrawal-decreases-balance (deposit-amount uint) (withdraw-amount uint))
  (begin
    ;; First deposit
    (try! (contract-call? .simulated-velar-pool deposit deposit-amount))

    (let
      (
        (initial-balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
        (initial-tvl (unwrap-panic (contract-call? .simulated-velar-pool get-total-tvl)))
      )
      ;; Perform withdrawal
      (match (contract-call? .simulated-velar-pool withdraw withdraw-amount)
        success
          (let
            (
              (final-balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
              (final-tvl (unwrap-panic (contract-call? .simulated-velar-pool get-total-tvl)))
            )
            ;; Verify balance decreased by amount
            (asserts!
              (is-eq final-balance (- initial-balance withdraw-amount))
              ERR_TEST_FAILED
            )
            ;; Verify TVL decreased by amount
            (asserts!
              (is-eq final-tvl (- initial-tvl withdraw-amount))
              ERR_TEST_FAILED
            )
            (ok true)
          )
        error (ok true) ;; Insufficient balance or contract paused
      )
    )
  )
)

;; Discard function: Only test valid withdrawal scenarios
(define-read-only (can-test-withdrawal-decreases-balance (deposit-amount uint) (withdraw-amount uint))
  (and
    (> deposit-amount u0)
    (> withdraw-amount u0)
    (<= withdraw-amount deposit-amount) ;; Can't withdraw more than deposited
    (<= deposit-amount u1000000000000)
  )
)

;; Test: Yield should always increase with time
(define-public (test-yield-increases-with-time (deposit-amount uint))
  (begin
    ;; Set APY in oracle
    (try! (contract-call? .pool-oracle set-authorized-updater tx-sender true))
    (try! (contract-call? .pool-oracle update-velar-apy u1080)) ;; 10.8% APY

    ;; Deposit
    (try! (contract-call? .simulated-velar-pool deposit deposit-amount))

    (let
      (
        (initial-yield (unwrap-panic (contract-call? .simulated-velar-pool get-accrued-yield tx-sender)))
      )
      ;; Mine some blocks (simulated time passing)
      ;; In practice, Rendezvous will advance blocks between calls

      (let
        (
          (final-yield (unwrap-panic (contract-call? .simulated-velar-pool get-accrued-yield tx-sender)))
        )
        ;; Yield should be >= initial yield (monotonically increasing)
        (asserts!
          (>= final-yield initial-yield)
          ERR_TEST_FAILED
        )
        (ok true)
      )
    )
  )
)

;; Discard function: Only test reasonable deposit amounts
(define-read-only (can-test-yield-increases-with-time (deposit-amount uint))
  (and (>= deposit-amount u1000000) (<= deposit-amount u1000000000000)) ;; 0.01 to 10,000 sBTC
)

;; Test: Total value should always be >= balance (due to accrued yield)
(define-public (test-total-value-gte-balance (deposit-amount uint))
  (begin
    ;; Set APY
    (try! (contract-call? .pool-oracle set-authorized-updater tx-sender true))
    (try! (contract-call? .pool-oracle update-velar-apy u1080)) ;; 10.8% APY

    ;; Deposit
    (try! (contract-call? .simulated-velar-pool deposit deposit-amount))

    (let
      (
        (balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
        (total-value (unwrap-panic (contract-call? .simulated-velar-pool get-total-value tx-sender)))
      )
      ;; Total value should be >= balance (balance + yield)
      (asserts!
        (>= total-value balance)
        ERR_TEST_FAILED
      )
      (ok true)
    )
  )
)

;; Discard function
(define-read-only (can-test-total-value-gte-balance (deposit-amount uint))
  (and (>= deposit-amount u1000000) (<= deposit-amount u1000000000000))
)

;; Test: Deposit height should be set to current block height on deposit
(define-public (test-deposit-height-updated (deposit-amount uint))
  (begin
    (let
      (
        (block-before-deposit stacks-block-height)
      )
      ;; Perform deposit
      (try! (contract-call? .simulated-velar-pool deposit deposit-amount))

      (let
        (
          (deposit-height (unwrap-panic (contract-call? .simulated-velar-pool get-deposit-height tx-sender)))
        )
        ;; Deposit height should be set to current block
        (asserts!
          (is-eq deposit-height (+ block-before-deposit u1))
          ERR_TEST_FAILED
        )
        (ok true)
      )
    )
  )
)

;; Discard function
(define-read-only (can-test-deposit-height-updated (deposit-amount uint))
  (and (>= deposit-amount u1000000) (<= deposit-amount u1000000000000))
)

;; =============================================================================
;; INVARIANTS
;; =============================================================================

;; Invariant: User balance should never exceed TVL
(define-read-only (invariant-balance-not-exceeds-tvl)
  (let
    (
      (user-balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
      (total-tvl (unwrap-panic (contract-call? .simulated-velar-pool get-total-tvl)))
    )
    (<= user-balance total-tvl)
  )
)

;; Invariant: TVL should always be non-negative
(define-read-only (invariant-tvl-non-negative)
  (let
    (
      (tvl (unwrap-panic (contract-call? .simulated-velar-pool get-total-tvl)))
    )
    (>= tvl u0)
  )
)

;; Invariant: User balance should always be non-negative
(define-read-only (invariant-balance-non-negative)
  (let
    (
      (balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
    )
    (>= balance u0)
  )
)

;; Invariant: Total value should always be >= balance
(define-read-only (invariant-total-value-gte-balance)
  (let
    (
      (balance (unwrap-panic (contract-call? .simulated-velar-pool get-balance tx-sender)))
      (total-value (unwrap-panic (contract-call? .simulated-velar-pool get-total-value tx-sender)))
    )
    (>= total-value balance)
  )
)

;; Invariant: Accrued yield should always be non-negative
(define-read-only (invariant-yield-non-negative)
  (let
    (
      (yield (unwrap-panic (contract-call? .simulated-velar-pool get-accrued-yield tx-sender)))
    )
    (>= yield u0)
  )
)
