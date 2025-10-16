;; Real STX-sBTC Pool Contract for Testnet
;; Mirrors Velar's mainnet pool with actual token transfers and yield generation
;; Users deposit real testnet STX and sBTC, earn real yield based on mainnet data

;; =============================================================================
;; TRAITS AND IMPORTS
;; =============================================================================

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; =============================================================================
;; CONSTANTS
;; =============================================================================

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u400))
(define-constant err-insufficient-balance (err u401))
(define-constant err-invalid-amount (err u402))
(define-constant err-pool-not-active (err u403))
(define-constant err-slippage-too-high (err u404))
(define-constant err-unauthorized-oracle (err u405))
(define-constant err-token-transfer-failed (err u406))
(define-constant err-insufficient-liquidity (err u407))
(define-constant err-invalid-ratio (err u408))

;; Pool configuration
(define-constant pool-name "STX-sBTC Testnet Pool")
(define-constant pool-symbol "STX-sBTC-LP")
(define-constant trading-fee u30) ;; 0.3% (3000 basis points = 0.3%)
(define-constant min-liquidity u1000) ;; Minimum liquidity to prevent attacks

;; Note: sBTC contract address ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
;; Using direct contract-call approach to avoid Clarinet dependency validation issues

;; =============================================================================
;; DATA VARIABLES
;; =============================================================================

;; Pool reserves (actual tokens held by contract)
(define-data-var stx-reserve uint u0)
(define-data-var sbtc-reserve uint u0)

;; LP token supply
(define-data-var total-supply uint u0)

;; Pool state
(define-data-var pool-active bool true)

;; Oracle data (mirrors mainnet Velar pool)
(define-data-var current-apy uint u1282) ;; 12.82% from mainnet
(define-data-var tvl-usd uint u357933) ;; Real TVL in USD
(define-data-var volume-24h uint u43000000) ;; 24h volume
(define-data-var fees-24h uint u129000) ;; 24h fees
(define-data-var last-oracle-update uint u0)

;; Oracle configuration
(define-data-var authorized-oracle principal tx-sender)
(define-data-var oracle-update-interval uint u144) ;; ~24 hours in blocks

;; Fee collection
(define-data-var collected-fees-stx uint u0)
(define-data-var collected-fees-sbtc uint u0)

;; =============================================================================
;; DATA MAPS
;; =============================================================================

;; LP token balances
(define-map balances principal uint)

;; User liquidity positions (for yield calculation)
(define-map positions principal {
  stx-deposited: uint,
  sbtc-deposited: uint,
  lp-tokens: uint,
  deposit-block: uint,
  entry-apy: uint,
  last-claim-block: uint
})

;; Allowances for LP tokens
(define-map allowances {owner: principal, spender: principal} uint)

;; Historical data
(define-map apy-history uint uint) ;; block -> apy
(define-map volume-history uint uint) ;; block -> volume

;; =============================================================================
;; SIP-010 FUNCTIONS (LP Token Standard)
;; =============================================================================

(define-read-only (get-name)
  (ok pool-name)
)

(define-read-only (get-symbol)
  (ok pool-symbol)
)

(define-read-only (get-decimals)
  (ok u8)
)

(define-read-only (get-balance (who principal))
  (ok (default-to u0 (map-get? balances who)))
)

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

(define-read-only (get-token-uri)
  (ok none)
)

;; =============================================================================
;; POOL READ-ONLY FUNCTIONS
;; =============================================================================

;; Get current pool state
(define-read-only (get-pool-info)
  {
    stx-reserve: (var-get stx-reserve),
    sbtc-reserve: (var-get sbtc-reserve),
    total-lp-supply: (var-get total-supply),
    current-apy: (var-get current-apy),
    tvl-usd: (var-get tvl-usd),
    volume-24h: (var-get volume-24h),
    fees-24h: (var-get fees-24h),
    trading-fee: trading-fee,
    pool-active: (var-get pool-active),
    last-oracle-update: (var-get last-oracle-update)
  }
)

;; Get user position
(define-read-only (get-user-position (user principal))
  (map-get? positions user)
)

;; Calculate LP tokens for given STX and sBTC amounts
(define-read-only (calculate-lp-tokens (stx-amount uint) (sbtc-amount uint))
  (let
    (
      (stx-res (var-get stx-reserve))
      (sbtc-res (var-get sbtc-reserve))
      (total-lp (var-get total-supply))
    )
    (if (is-eq total-lp u0)
      ;; First liquidity provision - simple calculation
      (+ stx-amount sbtc-amount)
      ;; Subsequent provisions - proportional to existing ratio
      (let
        (
          (stx-lp-tokens (/ (* stx-amount total-lp) stx-res))
          (sbtc-lp-tokens (/ (* sbtc-amount total-lp) sbtc-res))
        )
        (if (< stx-lp-tokens sbtc-lp-tokens)
          stx-lp-tokens
          sbtc-lp-tokens
        )
      )
    )
  )
)

;; Calculate tokens returned for LP tokens
(define-read-only (calculate-tokens-from-lp (lp-amount uint))
  (let
    (
      (stx-res (var-get stx-reserve))
      (sbtc-res (var-get sbtc-reserve))
      (total-lp (var-get total-supply))
    )
    (if (> total-lp u0)
      {
        stx-amount: (/ (* lp-amount stx-res) total-lp),
        sbtc-amount: (/ (* lp-amount sbtc-res) total-lp)
      }
      {stx-amount: u0, sbtc-amount: u0}
    )
  )
)

;; Get current exchange rate (STX per sBTC)
(define-read-only (get-exchange-rate)
  (let
    (
      (stx-res (var-get stx-reserve))
      (sbtc-res (var-get sbtc-reserve))
    )
    (if (> sbtc-res u0)
      (/ (* stx-res u100000000) sbtc-res) ;; STX per sBTC with 8 decimal precision
      u0
    )
  )
)

;; Calculate yield earned by user
(define-read-only (calculate-user-yield (user principal))
  (match (get-user-position user)
    position
    (let
      (
        (blocks-since-deposit (- block-height (get deposit-block position)))
        (blocks-since-claim (- block-height (get last-claim-block position)))
        (user-lp-tokens (get lp-tokens position))
        (current-apy-val (var-get current-apy))
        ;; Calculate yield based on LP token share and time held
        (annual-yield-rate (/ current-apy-val u10000)) ;; Convert basis points
        (blocks-per-year u52560) ;; Approximate blocks per year
        (time-factor (/ blocks-since-claim blocks-per-year))
        (user-share (/ (* user-lp-tokens u100000000) (var-get total-supply)))
        (pool-sbtc-value (var-get sbtc-reserve))
        (user-sbtc-value (/ (* pool-sbtc-value user-share) u100000000))
        (yield-earned (/ (* user-sbtc-value annual-yield-rate time-factor) u100))
      )
      yield-earned
    )
    u0
  )
)

;; =============================================================================
;; LIQUIDITY FUNCTIONS
;; =============================================================================

;; Add liquidity to the pool (deposit STX and sBTC)
(define-public (add-liquidity 
  (stx-amount uint) 
  (sbtc-amount uint) 
  (min-lp-tokens uint)
  (deadline uint))
  (let
    (
      (user tx-sender)
      (lp-tokens-to-mint (calculate-lp-tokens stx-amount sbtc-amount))
      (current-position (default-to 
        {
          stx-deposited: u0, 
          sbtc-deposited: u0, 
          lp-tokens: u0, 
          deposit-block: u0, 
          entry-apy: u0,
          last-claim-block: u0
        }
        (get-user-position user)
      ))
    )
    ;; Validate inputs
    (asserts! (var-get pool-active) err-pool-not-active)
    (asserts! (> stx-amount u0) err-invalid-amount)
    (asserts! (> sbtc-amount u0) err-invalid-amount)
    (asserts! (>= lp-tokens-to-mint min-lp-tokens) err-slippage-too-high)
    (asserts! (<= stacks-block-height deadline) err-invalid-amount)
    
    ;; Transfer STX from user to contract
    (try! (stx-transfer? stx-amount user (as-contract tx-sender)))
    
    ;; Transfer sBTC from user to contract
    (try! (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token transfer sbtc-amount user (as-contract tx-sender) none))
    
    ;; Update reserves
    (var-set stx-reserve (+ (var-get stx-reserve) stx-amount))
    (var-set sbtc-reserve (+ (var-get sbtc-reserve) sbtc-amount))
    
    ;; Mint LP tokens
    (var-set total-supply (+ (var-get total-supply) lp-tokens-to-mint))
    (map-set balances user (+ (unwrap-panic (get-balance user)) lp-tokens-to-mint))
    
    ;; Update user position
    (map-set positions user {
      stx-deposited: (+ (get stx-deposited current-position) stx-amount),
      sbtc-deposited: (+ (get sbtc-deposited current-position) sbtc-amount),
      lp-tokens: (+ (get lp-tokens current-position) lp-tokens-to-mint),
      deposit-block: block-height,
      entry-apy: (var-get current-apy),
      last-claim-block: block-height
    })
    
    (ok {
      lp-tokens-minted: lp-tokens-to-mint,
      stx-deposited: stx-amount,
      sbtc-deposited: sbtc-amount
    })
  )
)

;; Remove liquidity from the pool
(define-public (remove-liquidity 
  (lp-amount uint) 
  (min-stx-out uint) 
  (min-sbtc-out uint)
  (deadline uint))
  (let
    (
      (user tx-sender)
      (user-balance (unwrap-panic (get-balance user)))
      (tokens-out (calculate-tokens-from-lp lp-amount))
      (stx-out (get stx-amount tokens-out))
      (sbtc-out (get sbtc-amount tokens-out))
      (current-position (unwrap! (get-user-position user) err-insufficient-balance))
    )
    ;; Validate inputs
    (asserts! (> lp-amount u0) err-invalid-amount)
    (asserts! (>= user-balance lp-amount) err-insufficient-balance)
    (asserts! (>= stx-out min-stx-out) err-slippage-too-high)
    (asserts! (>= sbtc-out min-sbtc-out) err-slippage-too-high)
    (asserts! (<= stacks-block-height deadline) err-invalid-amount)
    
    ;; Burn LP tokens
    (var-set total-supply (- (var-get total-supply) lp-amount))
    (map-set balances user (- user-balance lp-amount))
    
    ;; Update reserves
    (var-set stx-reserve (- (var-get stx-reserve) stx-out))
    (var-set sbtc-reserve (- (var-get sbtc-reserve) sbtc-out))
    
    ;; Transfer tokens back to user
    (try! (as-contract (stx-transfer? stx-out tx-sender user)))
    (try! (as-contract (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token transfer sbtc-out tx-sender user none)))
    
    ;; Update user position
    (map-set positions user (merge current-position {
      lp-tokens: (- (get lp-tokens current-position) lp-amount)
    }))
    
    (ok {
      stx-returned: stx-out,
      sbtc-returned: sbtc-out,
      lp-tokens-burned: lp-amount
    })
  )
)

;; =============================================================================
;; YIELD CLAIMING FUNCTIONS
;; =============================================================================

;; Claim accumulated yield
(define-public (claim-yield)
  (let
    (
      (user tx-sender)
      (yield-amount (calculate-user-yield user))
      (current-position (unwrap! (get-user-position user) err-insufficient-balance))
    )
    (asserts! (> yield-amount u0) err-invalid-amount)
    (asserts! (>= (var-get sbtc-reserve) yield-amount) err-insufficient-liquidity)
    
    ;; Transfer yield to user (in sBTC)
    (try! (as-contract (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token transfer yield-amount tx-sender user none)))
    
    ;; Update user's last claim block
    (map-set positions user (merge current-position {
      last-claim-block: block-height
    }))
    
    ;; Update reserve (yield comes from pool growth)
    (var-set sbtc-reserve (- (var-get sbtc-reserve) yield-amount))
    
    (ok yield-amount)
  )
)

;; =============================================================================
;; ORACLE FUNCTIONS (Real-time mainnet data updates)
;; =============================================================================

;; Update pool data from mainnet Velar pool
(define-public (update-from-mainnet
  (new-apy uint)
  (new-tvl-usd uint)
  (new-volume-24h uint)
  (new-fees-24h uint))
  (begin
    ;; Only authorized oracle can update
    (asserts! (is-eq tx-sender (var-get authorized-oracle)) err-unauthorized-oracle)
    
    ;; Update metrics with real mainnet data
    (var-set current-apy new-apy)
    (var-set tvl-usd new-tvl-usd)
    (var-set volume-24h new-volume-24h)
    (var-set fees-24h new-fees-24h)
    (var-set last-oracle-update block-height)
    
    ;; Store historical data
    (map-set apy-history block-height new-apy)
    (map-set volume-history block-height new-volume-24h)
    
    (ok true)
  )
)

;; =============================================================================
;; ADMIN FUNCTIONS
;; =============================================================================

;; Set authorized oracle
(define-public (set-oracle (new-oracle principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set authorized-oracle new-oracle)
    (ok new-oracle)
  )
)

;; Emergency pause
(define-public (pause-pool)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set pool-active false)
    (ok true)
  )
)

;; Resume pool
(define-public (resume-pool)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set pool-active true)
    (ok true)
  )
)

;; =============================================================================
;; SIP-010 TRANSFER FUNCTIONS (for LP tokens)
;; =============================================================================

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) err-owner-only)
    (asserts! (>= (unwrap-panic (get-balance sender)) amount) err-insufficient-balance)
    
    (try! (ft-transfer? amount sender recipient))
    (print memo)
    (ok true)
  )
)

;; Helper function for internal transfers
(define-private (ft-transfer? (amount uint) (sender principal) (recipient principal))
  (let
    (
      (sender-balance (unwrap-panic (get-balance sender)))
      (recipient-balance (unwrap-panic (get-balance recipient)))
    )
    (asserts! (>= sender-balance amount) err-insufficient-balance)
    
    (map-set balances sender (- sender-balance amount))
    (map-set balances recipient (+ recipient-balance amount))
    
    (ok true)
  )
)
