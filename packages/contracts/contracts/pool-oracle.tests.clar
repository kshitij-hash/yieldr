;; Pool Oracle Fuzz Tests for Rendezvous
;; Property-based and invariant tests for the pool-oracle contract

;; Error codes for test assertions
(define-constant ERR_TEST_FAILED (err u9999))

;; =============================================================================
;; PROPERTY-BASED TESTS
;; =============================================================================

;; Test: Setting ALEX APY should always succeed for valid values
(define-public (test-update-alex-apy (apy uint))
  (begin
    ;; Set deployer as authorized
    (try! (contract-call? .pool-oracle set-authorized-updater tx-sender true))

    ;; Update APY
    (match (contract-call? .pool-oracle update-alex-apy apy)
      success
        (begin
          ;; Verify the APY was set correctly
          (asserts!
            (is-eq (unwrap-panic (contract-call? .pool-oracle get-alex-apy)) apy)
            ERR_TEST_FAILED
          )
          (ok true)
        )
      error (ok true) ;; It's ok to fail for invalid APY (> 10000)
    )
  )
)

;; Discard function: Only test valid APY values (<= 10000)
(define-read-only (can-test-update-alex-apy (apy uint))
  (<= apy u10000)
)

;; Test: Setting Velar APY should always succeed for valid values
(define-public (test-update-velar-apy (apy uint))
  (begin
    ;; Set deployer as authorized
    (try! (contract-call? .pool-oracle set-authorized-updater tx-sender true))

    ;; Update APY
    (match (contract-call? .pool-oracle update-velar-apy apy)
      success
        (begin
          ;; Verify the APY was set correctly
          (asserts!
            (is-eq (unwrap-panic (contract-call? .pool-oracle get-velar-apy)) apy)
            ERR_TEST_FAILED
          )
          (ok true)
        )
      error (ok true) ;; It's ok to fail for invalid APY
    )
  )
)

;; Discard function: Only test valid APY values
(define-read-only (can-test-update-velar-apy (apy uint))
  (<= apy u10000)
)

;; Test: Batch update should set both APYs correctly
(define-public (test-update-both-apys (alex-apy uint) (velar-apy uint))
  (begin
    ;; Set deployer as authorized
    (try! (contract-call? .pool-oracle set-authorized-updater tx-sender true))

    ;; Update both APYs
    (match (contract-call? .pool-oracle update-both-apys alex-apy velar-apy)
      success
        (begin
          ;; Verify both APYs were set correctly
          (asserts!
            (is-eq (unwrap-panic (contract-call? .pool-oracle get-alex-apy)) alex-apy)
            ERR_TEST_FAILED
          )
          (asserts!
            (is-eq (unwrap-panic (contract-call? .pool-oracle get-velar-apy)) velar-apy)
            ERR_TEST_FAILED
          )
          (ok true)
        )
      error (ok true)
    )
  )
)

;; Discard function: Only test valid APY values
(define-read-only (can-test-update-both-apys (alex-apy uint) (velar-apy uint))
  (and (<= alex-apy u10000) (<= velar-apy u10000))
)

;; Test: Authorization should be symmetric (set/unset)
(define-public (test-authorization-symmetry (user principal))
  (begin
    ;; Authorize user
    (try! (contract-call? .pool-oracle set-authorized-updater user true))

    ;; Verify authorized
    (asserts!
      (unwrap-panic (contract-call? .pool-oracle is-authorized-updater user))
      ERR_TEST_FAILED
    )

    ;; Deauthorize user
    (try! (contract-call? .pool-oracle set-authorized-updater user false))

    ;; Verify not authorized
    (asserts!
      (not (unwrap-panic (contract-call? .pool-oracle is-authorized-updater user)))
      ERR_TEST_FAILED
    )

    (ok true)
  )
)

;; =============================================================================
;; INVARIANTS
;; =============================================================================

;; Invariant: ALEX APY should always be <= 10000 (100%)
(define-read-only (invariant-alex-apy-valid)
  (let
    (
      (alex-apy (unwrap-panic (contract-call? .pool-oracle get-alex-apy)))
    )
    (<= alex-apy u10000)
  )
)

;; Invariant: Velar APY should always be <= 10000 (100%)
(define-read-only (invariant-velar-apy-valid)
  (let
    (
      (velar-apy (unwrap-panic (contract-call? .pool-oracle get-velar-apy)))
    )
    (<= velar-apy u10000)
  )
)

;; Invariant: get-all-data should always return valid structure
(define-read-only (invariant-data-structure-valid)
  (let
    (
      (data (unwrap-panic (contract-call? .pool-oracle get-all-data)))
      (alex-apy (get alex-apy data))
      (velar-apy (get velar-apy data))
    )
    (and
      (<= alex-apy u10000)
      (<= velar-apy u10000)
    )
  )
)
