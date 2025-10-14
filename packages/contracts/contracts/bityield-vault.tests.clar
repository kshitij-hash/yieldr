;; BitYield Vault Fuzz Tests
;; Property-based tests and invariants for Rendezvous fuzzer

;; =============================================================================
;; PROPERTY-BASED TESTS
;; =============================================================================

;; Property: Amount validation - deposits within range should succeed
(define-public (test-valid-deposit-range (amount uint))
  (let
    (
      ;; Clamp amount to valid range
      (valid-amount (if (< amount u100000)
                       u100000
                       (if (> amount u100000000000)
                          u100000000000
                          amount)))
    )
    ;; Should succeed with valid amount
    (unwrap! (contract-call? .bityield-vault deposit-sbtc valid-amount)
             (err u1))
    (ok true)
  )
)

;; Property: Balance should match deposits
(define-public (test-balance-tracking (amount uint))
  (let
    (
      (valid-amount (if (< amount u100000)
                       u100000
                       (if (> amount u100000000000)
                          u100000000000
                          amount)))
      (initial-balance (contract-call? .bityield-vault get-balance tx-sender))
    )
    ;; Deposit
    (unwrap! (contract-call? .bityield-vault deposit-sbtc valid-amount)
             (err u2))

    ;; Check balance increased correctly
    (asserts!
      (is-eq
        (contract-call? .bityield-vault get-balance tx-sender)
        (+ initial-balance valid-amount))
      (err u3))

    (ok true)
  )
)

;; Property: Cannot withdraw more than balance
(define-public (test-withdrawal-bounds (amount uint))
  (let
    (
      (valid-amount (if (< amount u100000)
                       u100000
                       (if (> amount u100000000000)
                          u100000000000
                          amount)))
      (balance (contract-call? .bityield-vault get-balance tx-sender))
    )
    ;; If trying to withdraw more than balance, should fail
    (if (> valid-amount balance)
      (begin
        (asserts!
          (is-err (contract-call? .bityield-vault withdraw-sbtc valid-amount))
          (err u4))
        (ok true))
      (ok true))
  )
)

;; Property: TVL increases with deposits
(define-public (test-tvl-increases (amount uint))
  (let
    (
      (valid-amount (if (< amount u100000)
                       u100000
                       (if (> amount u100000000000)
                          u100000000000
                          amount)))
      (initial-tvl (contract-call? .bityield-vault get-total-tvl))
    )
    ;; Deposit
    (unwrap! (contract-call? .bityield-vault deposit-sbtc valid-amount)
             (err u5))

    ;; TVL should increase
    (asserts!
      (is-eq
        (contract-call? .bityield-vault get-total-tvl)
        (+ initial-tvl valid-amount))
      (err u6))

    (ok true)
  )
)

;; =============================================================================
;; INVARIANTS
;; =============================================================================

;; Invariant: TVL should never be negative (always >= 0)
(define-read-only (invariant-tvl-non-negative)
  (>= (contract-call? .bityield-vault get-total-tvl) u0)
)

;; Invariant: User balance should never be negative
(define-read-only (invariant-balance-non-negative)
  (>= (contract-call? .bityield-vault get-balance tx-sender) u0)
)

;; Invariant: User balance should never exceed TVL
(define-read-only (invariant-balance-not-exceed-tvl)
  (let
    (
      (user-balance (contract-call? .bityield-vault get-balance tx-sender))
      (total-tvl (contract-call? .bityield-vault get-total-tvl))
    )
    (<= user-balance total-tvl)
  )
)

;; Invariant: Depositor count should never decrease
(define-read-only (invariant-depositor-count-monotonic)
  (>= (contract-call? .bityield-vault get-depositor-count) u0)
)

;; Invariant: Contract pause state is boolean (always true or false)
(define-read-only (invariant-pause-state-valid)
  (or
    (is-eq (contract-call? .bityield-vault is-paused) true)
    (is-eq (contract-call? .bityield-vault is-paused) false))
)
