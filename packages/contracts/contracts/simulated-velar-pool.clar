;; title: simulated-velar-pool
;; version: 1.0.0
;; summary: Simulated Velar STX-sBTC pool for testnet user experience
;; description: This contract simulates the Velar pool functionality on testnet.
;;              It accepts sBTC deposits, tracks balances, and calculates yield
;;              based on real mainnet APY data from the pool-oracle contract.

;; Error codes
(define-constant err-not-authorized (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-oracle-error (err u103))
(define-constant err-contract-paused (err u104))

;; Constants
(define-constant contract-owner tx-sender)
(define-constant blocks-per-year u52560) ;; Approx blocks in a year (~10 min/block)

;; Data variables
(define-data-var total-tvl uint u0)
(define-data-var paused bool false)

;; Data maps
(define-map user-balances principal uint)
(define-map user-deposit-heights principal uint)

;; Private helper functions

(define-private (is-owner)
  (is-eq tx-sender contract-owner)
)

(define-private (check-paused)
  (var-get paused)
)

;; Calculate yield for a user based on:
;; - Their balance
;; - Time elapsed since deposit (in blocks)
;; - Current APY from oracle (in basis points)
(define-private (calculate-yield (user principal))
  (let (
    (balance (default-to u0 (map-get? user-balances user)))
    (deposit-height (default-to u0 (map-get? user-deposit-heights user)))
    (current-height stacks-block-height)
    (blocks-elapsed (if (> current-height deposit-height)
                        (- current-height deposit-height)
                        u0))
  )
    (if (is-eq balance u0)
      u0
      (let (
        (apy-basis-points (unwrap-panic (contract-call? .pool-oracle get-velar-apy)))
        ;; Yield = balance * (APY/10000) * (blocks_elapsed/blocks_per_year)
        ;; To avoid rounding issues, we do: (balance * apy * blocks) / (10000 * blocks_per_year)
        (numerator (* (* balance apy-basis-points) blocks-elapsed))
        (denominator (* u10000 blocks-per-year))
      )
        (/ numerator denominator)
      )
    )
  )
)

;; Public functions

;; Deposit funds into the pool
(define-public (deposit (amount uint))
  (begin
    (asserts! (not (check-paused)) err-contract-paused)
    (asserts! (> amount u0) err-invalid-amount)

    (let (
      (current-balance (default-to u0 (map-get? user-balances tx-sender)))
      (new-balance (+ current-balance amount))
    )
      ;; Update user balance
      (map-set user-balances tx-sender new-balance)

      ;; Update deposit height (for yield calculation)
      (map-set user-deposit-heights tx-sender stacks-block-height)

      ;; Update total TVL
      (var-set total-tvl (+ (var-get total-tvl) amount))

      (ok true)
    )
  )
)

;; Withdraw funds from the pool
(define-public (withdraw (amount uint))
  (begin
    (asserts! (not (check-paused)) err-contract-paused)
    (asserts! (> amount u0) err-invalid-amount)

    (let (
      (current-balance (default-to u0 (map-get? user-balances tx-sender)))
    )
      (asserts! (>= current-balance amount) err-insufficient-balance)

      (let (
        (new-balance (- current-balance amount))
      )
        ;; Update user balance
        (if (is-eq new-balance u0)
          (map-delete user-balances tx-sender)
          (map-set user-balances tx-sender new-balance)
        )

        ;; Update total TVL
        (var-set total-tvl (- (var-get total-tvl) amount))

        (ok true)
      )
    )
  )
)

;; Admin function: Pause/unpause the pool
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-owner) err-not-authorized)
    (var-set paused pause)
    (ok true)
  )
)

;; Read-only functions

(define-read-only (get-balance (user principal))
  (ok (default-to u0 (map-get? user-balances user)))
)

(define-read-only (get-total-tvl)
  (ok (var-get total-tvl))
)

(define-read-only (get-owner)
  (ok contract-owner)
)

(define-read-only (is-paused)
  (ok (var-get paused))
)

(define-read-only (get-deposit-height (user principal))
  (ok (default-to u0 (map-get? user-deposit-heights user)))
)

;; Calculate and return the accrued yield for a user
(define-read-only (get-accrued-yield (user principal))
  (ok (calculate-yield user))
)

;; Get user's total value (balance + accrued yield)
(define-read-only (get-total-value (user principal))
  (let (
    (balance (default-to u0 (map-get? user-balances user)))
    (yield (calculate-yield user))
  )
    (ok (+ balance yield))
  )
)
