# BitYield Mainnet Migration Guide

## 🎯 **Testnet to Mainnet Migration Path**

This document outlines the simple migration process from our hackathon testnet demo to production mainnet deployment.

## 📋 **Current Architecture**

### **Testnet Setup (Hackathon Demo)**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Real Mainnet    │ →  │ Oracle Service   │ →  │ Testnet         │
│ Velar API       │    │ (5min updates)   │    │ Pool Simulator  │
│ (Live Data)     │    │                  │    │ (Mirror)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Mainnet Setup (Production)**
```
┌─────────────────┐    ┌──────────────────┐
│ Real Mainnet    │ →  │ Direct           │
│ Velar Pool      │    │ Integration      │
│ (Live Trading)  │    │                  │
└─────────────────┘    └──────────────────┘
```

## 🔄 **Migration Steps**

### **Step 1: Contract Address Updates**
Simply update contract addresses in configuration:

**Testnet Configuration:**
```clarity
;; Testnet addresses
(define-constant velar-pool 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.velar-pool-simulator)
(define-constant sbtc-token 'ST1R1061ZT6KPJXQ7PAXPFB6ZAZ6ZWW28GBQA1W0F.sbtc-token)
```

**Mainnet Configuration:**
```clarity
;; Mainnet addresses
(define-constant velar-pool 'SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-lp-token-v1_0_0-0070)
(define-constant sbtc-token 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
```

### **Step 2: Backend Configuration**
Update environment variables:

**Testnet (.env.testnet):**
```bash
STACKS_NETWORK=testnet
VELAR_SIMULATOR_MODE=true
ORACLE_ENABLED=true
```

**Mainnet (.env.mainnet):**
```bash
STACKS_NETWORK=mainnet
VELAR_SIMULATOR_MODE=false
ORACLE_ENABLED=false
```

### **Step 3: Contract Deployment**
Deploy contracts to mainnet:

```bash
# Deploy to mainnet
npm run deploy:mainnet

# Contracts to deploy:
# 1. bityield-auto-vault.clar
# 2. velar-adapter.clar (NOT velar-adapter-testnet.clar)
```

### **Step 4: Integration Switch**
Update Velar adapter to use real mainnet pool:

**Testnet (Simulator):**
```clarity
(contract-call? .velar-pool-simulator add-liquidity sbtc-amount min-lp-tokens)
```

**Mainnet (Real Pool):**
```clarity
(contract-call? 'SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-pool add-liquidity sbtc-amount min-lp-tokens)
```

## 📊 **Migration Comparison**

| Component | Testnet (Demo) | Mainnet (Production) |
|-----------|----------------|----------------------|
| **Data Source** | Real mainnet API → Simulator | Direct mainnet pool |
| **Pool Contract** | `velar-pool-simulator` | Real Velar pool contract |
| **sBTC Token** | Testnet sBTC | Real sBTC |
| **Risk** | Zero (testnet) | Real funds |
| **APY** | Mirrored from mainnet | Real trading performance |
| **Liquidity** | Simulated | Real market liquidity |
| **Slippage** | Simulated | Real market slippage |

## 🛡️ **Security Considerations**

### **Testnet Safety Features (Keep for Mainnet)**
- ✅ Emergency pause mechanism
- ✅ Owner controls
- ✅ Slippage protection
- ✅ Input validation
- ✅ Access controls

### **Additional Mainnet Security**
- 🔒 **Multi-sig wallet** for contract owner
- 🔍 **Security audit** before mainnet launch
- 📊 **Gradual rollout** with TVL limits
- 🚨 **Monitoring & alerts** for unusual activity

## 🎯 **Benefits of Our Approach**

### **For Hackathon Demo**
- ✅ **Real market data** (impressive for judges)
- ✅ **Live APY updates** during presentation
- ✅ **Zero risk** (testnet safety)
- ✅ **Authentic experience** (real Velar performance)

### **For Production**
- ✅ **Proven architecture** (tested on testnet)
- ✅ **Simple migration** (just config changes)
- ✅ **Real yield generation** (actual Velar trading)
- ✅ **Production ready** (no code changes needed)

## 📈 **Expected Performance**

### **Testnet (Current)**
```
APY: 12.61% (mirrored from mainnet)
TVL: $366K (mirrored)
Updates: Every 5 minutes
Accuracy: 100% mirror
```

### **Mainnet (Production)**
```
APY: Real-time market rate
TVL: Real market liquidity
Updates: Every block
Accuracy: 100% real
```

## 🚀 **Deployment Checklist**

### **Pre-Mainnet**
- [ ] Security audit completed
- [ ] Multi-sig wallet setup
- [ ] Monitoring systems ready
- [ ] Emergency procedures documented
- [ ] TVL limits configured

### **Mainnet Deployment**
- [ ] Deploy contracts to mainnet
- [ ] Update frontend configuration
- [ ] Switch backend to mainnet mode
- [ ] Disable oracle service
- [ ] Enable real Velar integration
- [ ] Test with small amounts first

### **Post-Deployment**
- [ ] Monitor contract interactions
- [ ] Verify yield calculations
- [ ] Check slippage protection
- [ ] Validate emergency controls
- [ ] Document any issues

## 💡 **Migration Timeline**

### **Phase 1: Hackathon Demo (Current)**
- ✅ Testnet with real data mirror
- ✅ Perfect for demonstration
- ✅ Zero risk, maximum impact

### **Phase 2: Mainnet Preparation (Post-Hackathon)**
- 🔍 Security audit (2-4 weeks)
- 🛡️ Multi-sig setup (1 week)
- 📊 Monitoring setup (1 week)

### **Phase 3: Mainnet Launch (Production)**
- 🚀 Contract deployment (1 day)
- ⚙️ Configuration updates (1 day)
- 🧪 Testing & validation (1 week)
- 📈 Full production launch

## 🎊 **Why This Approach is Perfect**

### **For Hackathon Judges**
- **Real Data**: "This is live Velar mainnet data, not fake numbers"
- **Live Updates**: "Watch the APY change during our demo"
- **Authentic**: "Our AI uses real market conditions"
- **Production Ready**: "Just flip a switch for mainnet"

### **For Users (Post-Hackathon)**
- **Proven System**: "Battle-tested architecture"
- **Real Yields**: "Actual Velar trading performance"
- **Secure**: "Audited and monitored"
- **Reliable**: "Same system that won the hackathon"

---

**🎯 This migration strategy gives us the best of both worlds: impressive hackathon demo with real data, and a clear path to production mainnet deployment.**
