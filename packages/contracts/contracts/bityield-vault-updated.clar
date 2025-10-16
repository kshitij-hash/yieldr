;; BitYield Vault Contract
;; Manages sBTC deposits and withdrawals for BitYield yield optimization
;;
;; This contract serves as the custody layer for user funds, providing:
;; - sBTC deposit and withdrawal functionality
;; - Balance tracking per user
;; - Total value locked (TVL) metrics
;; - Emergency pause mechanism

;; =============================================================================
;; CONSTANTS
;; =============================================================================

;; Contract owner (deployer) - Used for administrative functions
(define-constant contract-owner tx-sender)

;; Error codes (using ascending u100+ pattern for clear identification)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-transfer-failed (err u103))
(define-constant err-contract-paused (err u104))
(define-constant err-invalid-recipient (err u105))

;; Operational limits to prevent dust attacks and overflow
(define-constant min-deposit u100000)       ;; 0.1 sBTC minimum (100,000 sats)
(define-constant max-deposit u100000000000) ;; 1,000 sBTC maximum (100B sats)

;; =============================================================================
;; DATA VARIABLES
;; =============================================================================

;; Total value locked in the vault (aggregate sBTC across all users)
(define-data-var total-tvl uint u0)

;; Contract pause state for emergency stop mechanism
(define-data-var contract-paused bool false)

;; Total unique depositors (incremented on first deposit)
(define-data-var depositor-count uint u0)

;; =============================================================================
;; DATA MAPS
;; =============================================================================

;; User balance storage: maps user principal to their sBTC balance (in sats)
(define-map user-balances principal uint)

;; Deposit timestamp tracking: records block height of user's last deposit
(define-map deposit-timestamps principal uint)

;; Withdrawal timestamp tracking: records block height of user's last withdrawal
(define-map withdrawal-timestamps principal uint)

;; =============================================================================
;; READ-ONLY FUNCTIONS
;; =============================================================================

;; Get user's vault balance
;; Returns 0 for users who have never deposited
;; @param who: principal address to query
;; @returns uint: balance in sBTC sats
(define-read-only (get-balance (who principal))
  (default-to u0 (map-get? user-balances who))
)

;; Get total value locked in the vault
;; @returns uint: aggregate sBTC in vault (sats)
(define-read-only (get-total-tvl)
  (var-get total-tvl)
)

;; Get user's last deposit timestamp
;; Returns 0 for users who have never deposited
;; @param who: principal address to query
;; @returns uint: block height of last deposit
(define-read-only (get-deposit-timestamp (who principal))
  (default-to u0 (map-get? deposit-timestamps who))
)

;; Check if contract is paused
;; @returns bool: true if paused, false if active
(define-read-only (is-paused)
  (var-get contract-paused)
)

;; Get total number of unique depositors
;; @returns uint: count of users who have deposited
(define-read-only (get-depositor-count)
  (var-get depositor-count)
)

;; Get user's last withdrawal timestamp
;; Returns 0 for users who have never withdrawn
;; @param who: principal address to query
;; @returns uint: block height of last withdrawal
(define-read-only (get-withdrawal-timestamp (who principal))
  (default-to u0 (map-get? withdrawal-timestamps who))
)

;; =============================================================================
;; PUBLIC FUNCTIONS
;; =============================================================================

;; Deposit sBTC into the vault
;; Updates user balance, TVL, timestamps, and depositor count
;; @param amount: amount of sBTC to deposit (in sats)
;; @returns (response uint uint): ok with amount on success, error code on failure
(define-public (deposit-sbtc (amount uint))
  (let
    (
      (current-balance (get-balance tx-sender))
      (is-first-deposit (is-eq current-balance u0))
    )
    ;; Validate contract is not paused
    (asserts! (not (var-get contract-paused)) err-contract-paused)

    ;; Validate amount is non-zero and within limits
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (>= amount min-deposit) err-invalid-amount)
    (asserts! (<= amount max-deposit) err-invalid-amount)

    ;; Transfer sBTC from user to vault contract
    ;; User (tx-sender) transfers sBTC to this contract
    (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Update user balance
    (map-set user-balances tx-sender (+ current-balance amount))

    ;; Update total TVL
    (var-set total-tvl (+ (var-get total-tvl) amount))

    ;; Record deposit timestamp
    (map-set deposit-timestamps tx-sender stacks-block-height)

    ;; Increment depositor count if this is first deposit
    (if is-first-deposit
      (var-set depositor-count (+ (var-get depositor-count) u1))
      true
    )

    ;; Emit deposit event for off-chain indexing
    (print {
      event: "deposit",
      user: tx-sender,
      amount: amount,
      balance: (+ current-balance amount),
      tvl: (var-get total-tvl),
      block-height: stacks-block-height,
      is-first-deposit: is-first-deposit
    })

    (ok amount)
  )
)

;; Deposit sBTC into the vault on behalf of another user
;; Updates recipient's balance, TVL, timestamps, and depositor count
;; Sender pays, but recipient receives the balance
;; @param recipient: principal address to receive the deposit
;; @param amount: amount of sBTC to deposit (in sats)
;; @returns (response uint uint): ok with amount on success, error code on failure
(define-public (deposit-for (recipient principal) (amount uint))
  (let
    (
      (current-balance (get-balance recipient))
      (is-first-deposit (is-eq current-balance u0))
    )
    ;; Validate contract is not paused
    (asserts! (not (var-get contract-paused)) err-contract-paused)

    ;; Validate amount is non-zero and within limits
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (>= amount min-deposit) err-invalid-amount)
    (asserts! (<= amount max-deposit) err-invalid-amount)

    ;; Transfer sBTC from sender to vault contract
    ;; Sender (tx-sender) pays, but recipient gets the credited balance
    (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Update recipient's balance (not sender's)
    (map-set user-balances recipient (+ current-balance amount))

    ;; Update total TVL
    (var-set total-tvl (+ (var-get total-tvl) amount))

    ;; Record deposit timestamp for recipient
    (map-set deposit-timestamps recipient stacks-block-height)

    ;; Increment depositor count if this is recipient's first deposit
    (if is-first-deposit
      (var-set depositor-count (+ (var-get depositor-count) u1))
      true
    )

    ;; Emit deposit-for event for off-chain indexing
    (print {
      event: "deposit-for",
      sender: tx-sender,
      recipient: recipient,
      amount: amount,
      balance: (+ current-balance amount),
      tvl: (var-get total-tvl),
      block-height: stacks-block-height,
      is-first-deposit: is-first-deposit
    })

    (ok amount)
  )
)

;; Withdraw sBTC from the vault
;; Updates user balance, TVL, and withdrawal timestamp
;; @param amount: amount of sBTC to withdraw (in sats)
;; @returns (response uint uint): ok with amount on success, error code on failure
(define-public (withdraw-sbtc (amount uint))
  (let
    (
      (current-balance (get-balance tx-sender))
      (recipient tx-sender)
    )
    ;; Validate contract is not paused
    (asserts! (not (var-get contract-paused)) err-contract-paused)

    ;; Validate amount is non-zero
    (asserts! (> amount u0) err-invalid-amount)

    ;; Validate user has sufficient balance
    (asserts! (>= current-balance amount) err-insufficient-balance)

    ;; Transfer sBTC from vault contract back to user
    ;; Contract holds the tokens, so we use as-contract to call from contract context
    ;; In as-contract context, tx-sender becomes the contract itself, so we transfer from contract to recipient
    (unwrap! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender recipient none)) err-transfer-failed)

    ;; Update user balance
    (map-set user-balances recipient (- current-balance amount))

    ;; Update total TVL
    (var-set total-tvl (- (var-get total-tvl) amount))

    ;; Record withdrawal timestamp
    (map-set withdrawal-timestamps recipient stacks-block-height)

    ;; Emit withdrawal event for off-chain indexing
    (print {
      event: "withdrawal",
      user: recipient,
      amount: amount,
      balance: (- current-balance amount),
      tvl: (var-get total-tvl),
      block-height: stacks-block-height
    })

    (ok amount)
  )
)

;; Pause the contract (emergency stop)
;; Only callable by contract owner
;; @returns (response bool uint): ok true on success, error on failure
(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused true)

    ;; Emit pause event for off-chain indexing
    (print {
      event: "paused",
      owner: tx-sender,
      block-height: stacks-block-height
    })

    (ok true)
  )
)

;; Unpause the contract (resume operations)
;; Only callable by contract owner
;; @returns (response bool uint): ok true on success, error on failure
(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set contract-paused false)

    ;; Emit unpause event for off-chain indexing
    (print {
      event: "unpaused",
      owner: tx-sender,
      block-height: stacks-block-height
    })

    (ok true)
  )
)

;; =============================================================================
;; PRIVATE FUNCTIONS
;; =============================================================================
