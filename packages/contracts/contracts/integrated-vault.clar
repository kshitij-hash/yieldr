;; BitYield Integrated Vault Contract
;; Users deposit sBTC, Vault automatically invests in STX-sBTC pool, Users earn yield
;;
;; Flow: User sBTC -> Vault -> STX-sBTC Pool -> Earn Yield -> Claim Rewards

;; =============================================================================
;; CONSTANTS
;; =============================================================================

(define-constant contract-owner tx-sender)

;; Error codes
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-transfer-failed (err u103))
(define-constant err-contract-paused (err u104))
(define-constant err-pool-interaction-failed (err u105))
(define-constant err-insufficient-stx (err u106))

;; Operational limits
(define-constant min-deposit u1000000)        ;; 0.01 sBTC minimum
(define-constant max-deposit u100000000000)   ;; 1,000 sBTC maximum

;; Note: sBTC contract address ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
;; Using direct contract-call approach to avoid Clarinet dependency validation issues
(define-constant stx-pool-contract .real-stx-sbtc-pool)

;; =============================================================================
;; DATA VARIABLES
;; =============================================================================

;; Vault state
(define-data-var total-sbtc-deposited uint u0)
(define-data-var total-pool-lp-tokens uint u0)
(define-data-var contract-paused bool false)
(define-data-var depositor-count uint u0)
(define-data-var total-yield-claimed uint u0)

;; STX reserve for pool operations (vault needs STX to pair with sBTC)
(define-data-var stx-reserve uint u0)
(define-data-var auto-stx-acquisition bool true) ;; Auto-buy STX when needed

;; =============================================================================
;; DATA MAPS
;; =============================================================================

;; User data
(define-map user-sbtc-deposits principal uint)    ;; sBTC deposited by user
(define-map user-vault-shares principal uint)     ;; Vault shares (proportional to pool LP)
(define-map user-deposit-blocks principal uint)   ;; When user deposited
(define-map user-last-claim-blocks principal uint) ;; Last yield claim

;; Pool interaction tracking
(define-map vault-pool-positions uint {           ;; Track vault's positions in pool
  lp-tokens: uint,
  stx-contributed: uint,
  sbtc-contributed: uint,
  entry-block: uint
})

;; =============================================================================
;; READ-ONLY FUNCTIONS
;; =============================================================================

;; Get user's sBTC deposit amount
(define-read-only (get-user-deposit (who principal))
  (default-to u0 (map-get? user-sbtc-deposits who))
)

;; Get user's vault shares
(define-read-only (get-user-shares (who principal))
  (default-to u0 (map-get? user-vault-shares who))
)

;; Get vault's total info
(define-read-only (get-vault-info)
  {
    total-sbtc-deposited: (var-get total-sbtc-deposited),
    total-pool-lp-tokens: (var-get total-pool-lp-tokens),
    stx-reserve: (var-get stx-reserve),
    depositor-count: (var-get depositor-count),
    total-yield-claimed: (var-get total-yield-claimed),
    contract-paused: (var-get contract-paused)
  }
)

;; Calculate user's share of pool LP tokens
(define-read-only (calculate-user-lp-share (user principal))
  (let
    (
      (user-shares (get-user-shares user))
      (total-shares (var-get total-sbtc-deposited))
      (total-lp (var-get total-pool-lp-tokens))
    )
    (if (> total-shares u0)
      (/ (* user-shares total-lp) total-shares)
      u0
    )
  )
)

;; Calculate user's claimable yield from pool
(define-read-only (calculate-user-yield (user principal))
  (let
    (
      (user-lp-share (calculate-user-lp-share user))
    )
    (if (> user-lp-share u0)
      ;; Simplified yield calculation for read-only function
      (/ (* user-lp-share u1282) u10000) ;; Approximate 12.82% APY
      u0
    )
  )
)

;; =============================================================================
;; PRIVATE HELPER FUNCTIONS
;; =============================================================================

;; Calculate required STX for given sBTC amount (based on pool ratio)
(define-private (calculate-required-stx (sbtc-amount uint))
  (let
    (
      (pool-info (unwrap-panic (contract-call? stx-pool-contract get-pool-info)))
      (stx-reserve (get stx-reserve pool-info))
      (sbtc-reserve (get sbtc-reserve pool-info))
    )
    (if (> sbtc-reserve u0)
      (/ (* sbtc-amount stx-reserve) sbtc-reserve)
      u0 ;; If no liquidity, return 0
    )
  )
)

;; Acquire STX for pool operations (simplified - in production would use DEX)
(define-private (acquire-stx-for-pool (stx-needed uint))
  (let
    (
      (current-stx-reserve (var-get stx-reserve))
    )
    (if (>= current-stx-reserve stx-needed)
      (ok true) ;; We have enough STX
      ;; In production: would swap some sBTC for STX via DEX
      ;; For demo: assume we have STX or can get it
      (begin
        (var-set stx-reserve (+ current-stx-reserve stx-needed))
        (ok true)
      )
    )
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - DEPOSIT AND AUTO-INVEST
;; =============================================================================

;; Main deposit function: User deposits sBTC, Vault invests in STX-sBTC pool
(define-public (deposit-sbtc (sbtc-amount uint))
  (let
    (
      (user tx-sender)
      (current-deposit (get-user-deposit user))
      (current-shares (get-user-shares user))
      (is-first-deposit (is-eq current-deposit u0))
      (stx-needed (calculate-required-stx sbtc-amount))
    )
    ;; Validate inputs
    (asserts! (not (var-get contract-paused)) err-contract-paused)
    (asserts! (> sbtc-amount u0) err-invalid-amount)
    (asserts! (>= sbtc-amount min-deposit) err-invalid-amount)
    (asserts! (<= sbtc-amount max-deposit) err-invalid-amount)
    
    ;; Transfer sBTC from user to vault
    (try! (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token transfer sbtc-amount user (as-contract tx-sender) none))
    
    ;; Acquire STX for pool pairing
    (try! (acquire-stx-for-pool stx-needed))
    
    ;; Invest in STX-sBTC pool on behalf of user
    (match (as-contract (contract-call? stx-pool-contract add-liquidity 
                          stx-needed 
                          sbtc-amount 
                          u0 ;; min-lp-tokens (accept any)
                          (+ block-height u144))) ;; deadline (24 hours)
      success 
      (let
        (
          (lp-tokens-received (get lp-tokens-minted success))
        )
        ;; Update user records
        (map-set user-sbtc-deposits user (+ current-deposit sbtc-amount))
        (map-set user-vault-shares user (+ current-shares sbtc-amount))
        (map-set user-deposit-blocks user block-height)
        (map-set user-last-claim-blocks user block-height)
        
        ;; Update vault totals
        (var-set total-sbtc-deposited (+ (var-get total-sbtc-deposited) sbtc-amount))
        (var-set total-pool-lp-tokens (+ (var-get total-pool-lp-tokens) lp-tokens-received))
        (var-set stx-reserve (- (var-get stx-reserve) stx-needed))
        
        ;; Increment depositor count if first deposit
        (if is-first-deposit
          (var-set depositor-count (+ (var-get depositor-count) u1))
          true
        )
        
        (ok {
          sbtc-deposited: sbtc-amount,
          stx-paired: stx-needed,
          lp-tokens-received: lp-tokens-received,
          vault-shares: sbtc-amount
        })
      )
      error (err err-pool-interaction-failed)
    )
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - YIELD CLAIMING
;; =============================================================================

;; Claim yield from STX-sBTC pool
(define-public (claim-yield)
  (let
    (
      (user tx-sender)
      (user-lp-share (calculate-user-lp-share user))
      (estimated-yield (calculate-user-yield user))
    )
    ;; Validate user has position
    (asserts! (> (get-user-deposit user) u0) err-insufficient-balance)
    (asserts! (> estimated-yield u0) err-invalid-amount)
    
    ;; For now, just return the estimated yield (simplified for demo)
    ;; In production, this would claim from the actual pool
    (begin
      ;; Update tracking
      (map-set user-last-claim-blocks user block-height)
      (var-set total-yield-claimed (+ (var-get total-yield-claimed) estimated-yield))
      
      (ok estimated-yield)
    )
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - WITHDRAWAL
;; =============================================================================

;; Withdraw sBTC (removes liquidity from pool proportionally)
(define-public (withdraw-sbtc (sbtc-amount uint))
  (let
    (
      (user tx-sender)
      (user-deposit (get-user-deposit user))
      (user-shares (get-user-shares user))
      (withdrawal-ratio (/ (* sbtc-amount u100000000) user-deposit)) ;; Percentage to withdraw
      (lp-tokens-to-remove (/ (* (calculate-user-lp-share user) withdrawal-ratio) u100000000))
    )
    ;; Validate withdrawal
    (asserts! (> sbtc-amount u0) err-invalid-amount)
    (asserts! (>= user-deposit sbtc-amount) err-insufficient-balance)
    
    ;; Remove liquidity from pool
    (match (as-contract (contract-call? stx-pool-contract remove-liquidity
                          lp-tokens-to-remove
                          u0 ;; min-stx-out
                          u0 ;; min-sbtc-out  
                          (+ block-height u144))) ;; deadline
      success
      (let
        (
          (stx-returned (get stx-returned success))
          (sbtc-returned (get sbtc-returned success))
        )
        ;; Transfer sBTC back to user
        (try! (as-contract (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token transfer sbtc-returned tx-sender user none)))
        
        ;; Add STX back to vault reserve
        (var-set stx-reserve (+ (var-get stx-reserve) stx-returned))
        
        ;; Update user records
        (map-set user-sbtc-deposits user (- user-deposit sbtc-amount))
        (map-set user-vault-shares user (- user-shares sbtc-amount))
        
        ;; Update vault totals
        (var-set total-sbtc-deposited (- (var-get total-sbtc-deposited) sbtc-amount))
        (var-set total-pool-lp-tokens (- (var-get total-pool-lp-tokens) lp-tokens-to-remove))
        
        (ok {
          sbtc-withdrawn: sbtc-returned,
          stx-returned-to-vault: stx-returned,
          lp-tokens-burned: lp-tokens-to-remove
        })
      )
      error (err err-pool-interaction-failed)
    )
  )
)

;; =============================================================================
;; ADMIN FUNCTIONS
;; =============================================================================

;; Add STX to vault reserve (for pool operations)
(define-public (add-stx-reserve (stx-amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))
    (var-set stx-reserve (+ (var-get stx-reserve) stx-amount))
    (ok stx-amount)
  )
)

;; Emergency pause
(define-public (pause-vault)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused true)
    (ok true)
  )
)

;; Resume operations
(define-public (resume-vault)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused false)
    (ok true)
  )
)
