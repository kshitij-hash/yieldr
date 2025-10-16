;; title: pool-oracle
;; version: 1.1.0
;; summary: Oracle contract for storing APY and TVL data from mainnet ALEX and Velar pools
;; description: This contract maintains synchronized APY and TVL data from mainnet STX-sBTC pools.
;;              Only authorized updaters (backend services) can modify the data.
;;              APY values are stored in basis points (100 = 1.00%).
;;              TVL values are stored in satoshis (100000000 = 1 BTC).

;; Error codes
(define-constant err-not-authorized (err u100))
(define-constant err-invalid-apy (err u101))
(define-constant err-invalid-principal (err u102))
(define-constant err-already-authorized (err u103))
(define-constant err-cannot-remove-deployer (err u104))
(define-constant err-invalid-tvl (err u105))

;; Maximum APY: 100.00% (10000 basis points)
(define-constant max-apy u10000)

;; Contract deployer (always authorized)
(define-constant contract-deployer tx-sender)

;; Data variables for storing APY values (in basis points)
(define-data-var alex-apy uint u0)
(define-data-var velar-apy uint u0)

;; Data variables for storing TVL values (in satoshis)
(define-data-var alex-tvl uint u0)
(define-data-var velar-tvl uint u0)

;; Timestamps for last update (block height)
(define-data-var alex-last-updated uint u0)
(define-data-var velar-last-updated uint u0)

;; Map to track authorized updaters (backend services)
(define-map authorized-updaters principal bool)

;; Initialize deployer as authorized updater
(map-set authorized-updaters contract-deployer true)

;; Authorization management
;; Only the contract deployer can manage authorized updaters
(define-public (set-authorized-updater (updater principal) (authorized bool))
  (begin
    (asserts! (is-eq tx-sender contract-deployer) err-not-authorized)

    ;; Prevent removing deployer's authorization
    (asserts!
      (not (and (is-eq updater contract-deployer) (not authorized)))
      err-cannot-remove-deployer
    )

    (ok (map-set authorized-updaters updater authorized))
  )
)

;; Check if a principal is an authorized updater
(define-read-only (is-authorized-updater (updater principal))
  (ok (default-to false (map-get? authorized-updaters updater)))
)

;; Private helper to verify authorization
(define-private (verify-authorized)
  (default-to false (map-get? authorized-updaters tx-sender))
)

;; Private helper to validate APY value
(define-private (is-valid-apy (apy uint))
  (<= apy max-apy)
)

;; Private helper to validate TVL value (must be non-negative, no upper limit)
(define-private (is-valid-tvl (tvl uint))
  true ;; Any uint is valid for TVL
)

;; Update ALEX pool APY
(define-public (update-alex-apy (new-apy uint))
  (begin
    (asserts! (verify-authorized) err-not-authorized)
    (asserts! (is-valid-apy new-apy) err-invalid-apy)

    (var-set alex-apy new-apy)
    (var-set alex-last-updated stacks-block-height)
    (ok true)
  )
)

;; Update Velar pool APY
(define-public (update-velar-apy (new-apy uint))
  (begin
    (asserts! (verify-authorized) err-not-authorized)
    (asserts! (is-valid-apy new-apy) err-invalid-apy)

    (var-set velar-apy new-apy)
    (var-set velar-last-updated stacks-block-height)
    (ok true)
  )
)

;; Update both APYs in a single transaction (gas efficient)
(define-public (update-both-apys (new-alex-apy uint) (new-velar-apy uint))
  (begin
    (asserts! (verify-authorized) err-not-authorized)
    (asserts! (is-valid-apy new-alex-apy) err-invalid-apy)
    (asserts! (is-valid-apy new-velar-apy) err-invalid-apy)

    (var-set alex-apy new-alex-apy)
    (var-set velar-apy new-velar-apy)
    (var-set alex-last-updated stacks-block-height)
    (var-set velar-last-updated stacks-block-height)
    (ok true)
  )
)

;; Update ALEX pool TVL
(define-public (update-alex-tvl (new-tvl uint))
  (begin
    (asserts! (verify-authorized) err-not-authorized)
    (asserts! (is-valid-tvl new-tvl) err-invalid-tvl)

    (var-set alex-tvl new-tvl)
    (var-set alex-last-updated stacks-block-height)
    (ok true)
  )
)

;; Update Velar pool TVL
(define-public (update-velar-tvl (new-tvl uint))
  (begin
    (asserts! (verify-authorized) err-not-authorized)
    (asserts! (is-valid-tvl new-tvl) err-invalid-tvl)

    (var-set velar-tvl new-tvl)
    (var-set velar-last-updated stacks-block-height)
    (ok true)
  )
)

;; Update both APYs and TVLs in a single transaction (most gas efficient)
(define-public (update-all-data (new-alex-apy uint) (new-velar-apy uint) (new-alex-tvl uint) (new-velar-tvl uint))
  (begin
    (asserts! (verify-authorized) err-not-authorized)
    (asserts! (is-valid-apy new-alex-apy) err-invalid-apy)
    (asserts! (is-valid-apy new-velar-apy) err-invalid-apy)
    (asserts! (is-valid-tvl new-alex-tvl) err-invalid-tvl)
    (asserts! (is-valid-tvl new-velar-tvl) err-invalid-tvl)

    (var-set alex-apy new-alex-apy)
    (var-set velar-apy new-velar-apy)
    (var-set alex-tvl new-alex-tvl)
    (var-set velar-tvl new-velar-tvl)
    (var-set alex-last-updated stacks-block-height)
    (var-set velar-last-updated stacks-block-height)
    (ok true)
  )
)

;; Read-only functions to get current APY values

(define-read-only (get-alex-apy)
  (ok (var-get alex-apy))
)

(define-read-only (get-velar-apy)
  (ok (var-get velar-apy))
)

(define-read-only (get-both-apys)
  (ok {
    alex: (var-get alex-apy),
    velar: (var-get velar-apy)
  })
)

(define-read-only (get-last-updated)
  (ok {
    alex-updated: (var-get alex-last-updated),
    velar-updated: (var-get velar-last-updated)
  })
)

;; Read-only functions to get TVL values

(define-read-only (get-alex-tvl)
  (ok (var-get alex-tvl))
)

(define-read-only (get-velar-tvl)
  (ok (var-get velar-tvl))
)

(define-read-only (get-both-tvls)
  (ok {
    alex: (var-get alex-tvl),
    velar: (var-get velar-tvl)
  })
)

;; Get all APY and TVL data with timestamps in a single call
(define-read-only (get-all-data)
  (ok {
    alex-apy: (var-get alex-apy),
    velar-apy: (var-get velar-apy),
    alex-tvl: (var-get alex-tvl),
    velar-tvl: (var-get velar-tvl),
    alex-updated: (var-get alex-last-updated),
    velar-updated: (var-get velar-last-updated)
  })
)
