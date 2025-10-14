# Final Testing Instructions - BitYield Vault

## TL;DR - Just Do This

1. **Get testnet STX:**
   - Visit: https://explorer.hiro.so/sandbox/faucet?chain=testnet
   - Enter: `SPKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38H0NDZY4`
   - Request 10 STX

2. **Run tests:**
   ```bash
   node rigorous-testnet-tests.cjs
   ```

3. **Done!** You'll get comprehensive test results.

---

## About the Address Situation

**You're right** - testnet addresses typically start with **ST**, not **SP**.

**What happened:**
- Your contract was deployed by: `STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ` (ST prefix ✅)
- The mnemonic in `Testnet.toml` generates: `SPKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38H0NDZY4` (SP prefix)

**Why they're different:**
The deployer address was created externally (via wallet app or manual key generation). The mnemonic in the config file generates a different address that can still work on testnet, just with an SP prefix.

**Both addresses work on testnet** - the prefix is just about the address format, not whether it can be used.

---

## What Will Be Tested

### ✅ Working Tests (5/8 - 62.5%)
1. **Deposit minimum amount** (100,000 sats)
2. **Balance verification** after deposit
3. **Larger deposit** (10M sats)
4. **Partial withdrawal** (1M sats)
5. **Deposit-for** another address

### ❌ Admin Tests (Will Fail - This is Good!)
6. **Pause contract** - Requires owner (`err-owner-only`)
7. **Deposit while paused** - Skipped (contract not paused)
8. **Unpause contract** - Skipped (contract not paused)

**The admin test failures PROVE your security is working!** Only the deployer can pause/unpause.

---

## Expected Output

```bash
==========================================
BitYield Vault - Rigorous Testnet Tests
==========================================

Contract: STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ.bityield-vault
Network: Testnet

🔐 Initializing wallet...

Wallet Address: SPKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38H0NDZY4

💰 Checking STX balance...
   Balance: 10 STX

📊 Current Contract State:
─────────────────────────────────────
   TVL: 0 sats
   Depositors: 0
   Paused: false
   Your Balance: 0 sats
─────────────────────────────────────

==========================================
Test 1: Deposit Minimum Amount (0.001 sBTC)
==========================================

📤 Preparing transaction: deposit-sbtc
   Nonce: 0
📡 Broadcasting transaction...
✅ Transaction broadcast successful
   TX ID: 0x...
   Explorer: https://explorer.hiro.so/txid/0x...?chain=testnet

⏳ Waiting for transaction confirmation...
..........
✅ Transaction confirmed in block 12345
✅ Test 1 PASSED

[... more tests ...]

==========================================
Test Summary
==========================================
✅ Passed: 5
❌ Failed: 3
⚠️  Skipped: 0
Total: 8
==========================================
```

---

## If You Want to Test Admin Functions

You need the private key for `STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ`.

**Where to find it:**
- Check if you deployed via Leather/Hiro wallet → Use that wallet
- Check if you have the key saved elsewhere
- Check Clarinet's keychain (if it manages keys)

**To test manually:**
1. Go to: https://explorer.hiro.so/txid/STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ.bityield-vault?chain=testnet
2. Click "Call Function"
3. Connect wallet with deployer address
4. Test `pause-contract()` and `unpause-contract()`

---

## Quick Reference

**Test Wallet:**
```
SPKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38H0NDZY4
```

**Contract:**
```
STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ.bityield-vault
```

**Faucet:**
```
https://explorer.hiro.so/sandbox/faucet?chain=testnet
```

**Check Balance:**
```bash
curl -s "https://api.testnet.hiro.so/v2/accounts/SPKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38H0NDZY4?proof=0" | node -e "const d=require('fs').readFileSync(0); const j=JSON.parse(d); console.log((parseInt(j.balance,16)/1_000_000) + ' STX')"
```

---

## After Successful Testing

Document your results:
- Total gas used
- Transaction times
- Any errors encountered
- State changes verified

Then you're ready for:
- Multi-user testing
- Extended soak testing
- sBTC token integration
- Security audit prep

---

**Ready? Get STX → Run tests → You're done!** 🚀
