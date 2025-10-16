;; BitYield Auto-Investment Vault Contract
;; Enhanced vault that automatically invests user deposits for optimal yield
;;
;; This contract extends the basic vault with:
;; - Automatic investment on deposit
;; - Multi-protocol allocation tracking
;; - Yield optimization and rebalancing
;; - Automated reward harvesting

;; =============================================================================
;; CONSTANTS
;; =============================================================================

;; Contract owner (deployer)
(define-constant contract-owner tx-sender)

;; Error codes
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-transfer-failed (err u103))
(define-constant err-contract-paused (err u104))
(define-constant err-invalid-recipient (err u105))
(define-constant err-protocol-not-found (err u106))
(define-constant err-invalid-allocation (err u107))
(define-constant err-rebalance-threshold-not-met (err u108))

;; Operational limits
(define-constant min-deposit u100000)       ;; 0.1 sBTC minimum
(define-constant max-deposit u100000000000) ;; 1,000 sBTC maximum
(define-constant max-protocols u10)         ;; Maximum 10 protocols
(define-constant rebalance-threshold u200)  ;; 2% minimum improvement for rebalancing

;; Protocol identifiers
(define-constant protocol-velar u1)
(define-constant protocol-alex u2)
(define-constant protocol-zest u3)

;; =============================================================================
;; DATA VARIABLES
;; =============================================================================

;; Basic vault state
(define-data-var total-tvl uint u0)
(define-data-var contract-paused bool false)
(define-data-var depositor-count uint u0)

;; Auto-investment state
(define-data-var auto-investment-enabled bool true)
(define-data-var last-rebalance-block uint u0)
(define-data-var total-yield-earned uint u0)

;; =============================================================================
;; DATA MAPS
;; =============================================================================

;; User data
(define-map user-balances principal uint)
(define-map user-shares principal uint)        ;; Vault shares for yield distribution
(define-map deposit-timestamps principal uint)
(define-map withdrawal-timestamps principal uint)

;; Protocol allocation tracking
(define-map protocol-allocations uint uint)    ;; protocol-id -> total sBTC allocated
(define-map protocol-yields uint uint)         ;; protocol-id -> total yield earned
(define-map user-protocol-shares principal (list 10 {protocol: uint, shares: uint}))

;; Protocol configuration
(define-map protocol-configs uint {
  name: (string-ascii 20),
  contract-address: principal,
  enabled: bool,
  max-allocation-pct: uint,  ;; Maximum % of TVL that can go to this protocol
  risk-level: uint           ;; 1=low, 2=medium, 3=high
})

;; =============================================================================
;; READ-ONLY FUNCTIONS
;; =============================================================================

;; Get user's vault balance (total across all protocols)
(define-read-only (get-balance (who principal))
  (default-to u0 (map-get? user-balances who))
)

;; Get user's vault shares (for yield distribution)
(define-read-only (get-user-shares (who principal))
  (default-to u0 (map-get? user-shares who))
)

;; Get total TVL across all protocols
(define-read-only (get-total-tvl)
  (var-get total-tvl)
)

;; Get allocation for specific protocol
(define-read-only (get-protocol-allocation (protocol-id uint))
  (default-to u0 (map-get? protocol-allocations protocol-id))
)

;; Get total yield earned by protocol
(define-read-only (get-protocol-yield (protocol-id uint))
  (default-to u0 (map-get? protocol-yields protocol-id))
)

;; Get user's allocation breakdown
(define-read-only (get-user-allocations (who principal))
  (default-to (list) (map-get? user-protocol-shares who))
)

;; Check if auto-investment is enabled
(define-read-only (is-auto-investment-enabled)
  (var-get auto-investment-enabled)
)

;; Get protocol configuration
(define-read-only (get-protocol-config (protocol-id uint))
  (map-get? protocol-configs protocol-id)
)

;; Calculate user's share of total vault (for yield distribution)
(define-read-only (get-user-vault-percentage (who principal))
  (let
    (
      (user-shares-amount (get-user-shares who))
      (total-shares (var-get total-tvl)) ;; Using TVL as total shares for now
    )
    (if (> total-shares u0)
      (/ (* user-shares-amount u10000) total-shares) ;; Return as basis points (0.01%)
      u0
    )
  )
)

;; =============================================================================
;; PRIVATE FUNCTIONS
;; =============================================================================

;; Initialize protocol configurations (called once during deployment)
(define-private (initialize-protocols)
  (begin
    ;; Velar DEX configuration
    (map-set protocol-configs protocol-velar {
      name: "Velar",
      contract-address: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar-dex,
      enabled: true,
      max-allocation-pct: u5000, ;; 50% max allocation
      risk-level: u2              ;; Medium risk (LP pools)
    })
    
    ;; ALEX Protocol configuration (disabled until integration ready)
    (map-set protocol-configs protocol-alex {
      name: "ALEX",
      contract-address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-vault,
      enabled: false,             ;; Disabled until real integration
      max-allocation-pct: u6000,  ;; 60% max allocation
      risk-level: u2               ;; Medium risk
    })
    
    ;; Zest Protocol configuration (disabled until ready)
    (map-set protocol-configs protocol-zest {
      name: "Zest",
      contract-address: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.zest-protocol,
      enabled: false,             ;; Disabled until real integration
      max-allocation-pct: u3000,  ;; 30% max allocation
      risk-level: u1               ;; Low risk (lending)
    })
    
    true
  )
)

;; Calculate optimal allocation based on current yields and risk
;; For Phase 1A: Simple logic - 100% to Velar if enabled
(define-private (calculate-optimal-allocation (amount uint))
  (let
    (
      (velar-config (unwrap-panic (get-protocol-config protocol-velar)))
    )
    ;; Phase 1A: Simple allocation - 100% to Velar if enabled
    (if (get enabled velar-config)
      (list {protocol: protocol-velar, amount: amount})
      (list) ;; No allocation if Velar disabled
    )
  )
)

;; Execute investment in specific protocol
(define-private (invest-in-protocol (protocol-id uint) (amount uint))
  (let
    (
      (protocol-config (unwrap! (get-protocol-config protocol-id) err-protocol-not-found))
    )
    ;; Update allocation tracking
    (map-set protocol-allocations protocol-id 
      (+ (get-protocol-allocation protocol-id) amount))
    
    ;; Call appropriate protocol adapter
    (if (is-eq protocol-id protocol-velar)
      ;; Invest in Velar via integrated vault
      (match (contract-call? .integrated-vault deposit-sbtc amount)
        success (ok amount)
        error (err error))
      ;; Other protocols (ALEX, Zest) - not implemented yet
      (ok amount) ;; Just track for now
    )
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - ENHANCED DEPOSIT WITH AUTO-INVESTMENT
;; =============================================================================

;; Enhanced deposit with automatic investment
;; Deposits sBTC and automatically invests in optimal protocols
(define-public (deposit-and-invest (amount uint))
  (let
    (
      (current-balance (get-balance tx-sender))
      (current-shares (get-user-shares tx-sender))
      (is-first-deposit (is-eq current-balance u0))
      (optimal-allocation (calculate-optimal-allocation amount))
    )
    ;; Validate contract state
    (asserts! (not (var-get contract-paused)) err-contract-paused)
    (asserts! (var-get auto-investment-enabled) err-contract-paused)
    
    ;; Validate amount
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (>= amount min-deposit) err-invalid-amount)
    (asserts! (<= amount max-deposit) err-invalid-amount)
    
    ;; Transfer sBTC from user to vault
    (try! (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token 
           transfer amount tx-sender (as-contract tx-sender) none))
    
    ;; Update user balance and shares
    (map-set user-balances tx-sender (+ current-balance amount))
    (map-set user-shares tx-sender (+ current-shares amount))
    
    ;; Update total TVL
    (var-set total-tvl (+ (var-get total-tvl) amount))
    
    ;; Record deposit timestamp
    (map-set deposit-timestamps tx-sender block-height)
    
    ;; Increment depositor count if first deposit
    (if is-first-deposit
      (var-set depositor-count (+ (var-get depositor-count) u1))
      true
    )
    
    ;; Execute auto-investment based on optimal allocation
    (try! (execute-investment-strategy optimal-allocation))
    
    (ok amount)
  )
)

;; Execute investment strategy (allocate funds to protocols)
(define-private (execute-investment-strategy (allocations (list 10 {protocol: uint, amount: uint})))
  (fold execute-single-allocation allocations (ok u0))
)

;; Execute single protocol allocation
(define-private (execute-single-allocation 
  (allocation {protocol: uint, amount: uint}) 
  (previous-result (response uint uint)))
  (match previous-result
    success (invest-in-protocol (get protocol allocation) (get amount allocation))
    error (err error)
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - WITHDRAWAL WITH AUTO-LIQUIDATION
;; =============================================================================

;; Enhanced withdrawal with automatic liquidation from protocols
(define-public (withdraw-with-liquidation (amount uint))
  (let
    (
      (current-balance (get-balance tx-sender))
      (current-shares (get-user-shares tx-sender))
    )
    ;; Validate contract state
    (asserts! (not (var-get contract-paused)) err-contract-paused)
    
    ;; Validate amount and balance
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (>= current-balance amount) err-insufficient-balance)
    
    ;; TODO: Liquidate from protocols proportionally
    ;; For Phase 1A: Simple withdrawal from vault balance
    
    ;; Transfer sBTC back to user
    (unwrap! (as-contract (contract-call? 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token 
             transfer amount tx-sender tx-sender none)) err-transfer-failed)
    
    ;; Update user balance and shares
    (map-set user-balances tx-sender (- current-balance amount))
    (map-set user-shares tx-sender (- current-shares amount))
    
    ;; Update total TVL
    (var-set total-tvl (- (var-get total-tvl) amount))
    
    ;; Record withdrawal timestamp
    (map-set withdrawal-timestamps tx-sender block-height)
    
    (ok amount)
  )
)

;; =============================================================================
;; PUBLIC FUNCTIONS - ADMIN FUNCTIONS
;; =============================================================================

;; Enable/disable auto-investment
(define-public (set-auto-investment (enabled bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set auto-investment-enabled enabled)
    (ok enabled)
  )
)

;; Update protocol configuration
(define-public (update-protocol-config 
  (protocol-id uint) 
  (enabled bool) 
  (max-allocation-pct uint))
  (let
    (
      (current-config (unwrap! (get-protocol-config protocol-id) err-protocol-not-found))
    )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= max-allocation-pct u10000) err-invalid-allocation) ;; Max 100%
    
    (map-set protocol-configs protocol-id (merge current-config {
      enabled: enabled,
      max-allocation-pct: max-allocation-pct
    }))
    
    (ok true)
  )
)

;; Emergency pause
(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused true)
    (ok true)
  )
)

;; Resume operations
(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused false)
    (ok true)
  )
)

;; =============================================================================
;; INITIALIZATION
;; =============================================================================

;; Initialize protocol configurations on deployment
(initialize-protocols)
