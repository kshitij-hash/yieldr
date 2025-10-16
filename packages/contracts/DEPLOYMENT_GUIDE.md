# BitYield Hackathon Deployment Guide

## 🎯 **Quick Start for Hackathon Demo**

This guide helps you deploy BitYield's real-time mainnet mirror system to testnet for your hackathon demonstration.

## 📋 **Prerequisites**

### **Required Tools**
```bash
# Install Clarinet (Stacks development tool)
curl --proto '=https' --tlsv1.2 -sSf https://install.clarinet.so | sh

# Verify installation
clarinet --version

# Install Node.js dependencies
npm install
```

### **Required Configuration**
Your `testnet.toml` is already configured with:
```toml
[network]
name = "testnet"
stacks_node_rpc_address = "https://api.testnet.hiro.so"
deployment_fee_rate = 10

[accounts.deployer]
mnemonic = "crucial lab toy weather huge turn valve swift satisfy moon wet absent number insane plug change bounce then mandate crowd office carpet crunch honey"
```

## 🚀 **Deployment Options**

### **Option 1: Simple Deployment (Recommended for Demo)**
```bash
# Deploy using our simplified script
npm run deploy:simple

# This will deploy:
# 1. velar-pool-simulator (mirrors mainnet data)
# 2. velar-adapter-testnet (handles investments)
# 3. bityield-auto-vault (auto-investment logic)
```

### **Option 2: Clarinet Deployment (Production)**
```bash
# Generate deployment plan
npm run deploy:generate

# Check deployment plan
npm run deploy:check

# Deploy to testnet
npm run deploy:testnet
```

## 📊 **What Gets Deployed**

### **1. Velar Pool Simulator**
```clarity
Contract: velar-pool-simulator.clar
Purpose: Mirrors real mainnet Velar pool data
Features:
- Real-time APY updates (12.61%)
- Live TVL mirroring ($366K)
- Authentic pool behavior
- Oracle-driven updates
```

### **2. Velar Adapter (Testnet)**
```clarity
Contract: velar-adapter-testnet.clar
Purpose: Handles sBTC investments in simulator
Features:
- LP token management
- Yield tracking
- Position monitoring
- Slippage protection
```

### **3. Auto-Investment Vault**
```clarity
Contract: bityield-auto-vault.clar
Purpose: Automated investment strategies
Features:
- Auto-investment on deposit
- Multi-protocol support
- Risk management
- Emergency controls
```

## 🔧 **Post-Deployment Setup**

### **1. Start Oracle Service**
```bash
# In backend directory
cd ../backend

# Start the oracle to mirror mainnet data
npm run start:oracle

# Or via API
curl -X POST http://localhost:3001/api/oracle/start
```

### **2. Verify Deployment**
```bash
# Check contract deployment
clarinet console

# In console, verify contracts exist:
(contract-call? .velar-pool-simulator get-pool-info)
(contract-call? .bityield-auto-vault get-total-tvl)
```

### **3. Test Integration**
```bash
# Run integration tests
npm run test:integration

# Test oracle updates
curl http://localhost:3001/api/oracle/mainnet-data
```

## 📱 **Frontend Integration**

### **Update Frontend Configuration**
```typescript
// In frontend/.env.local
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_VAULT_CONTRACT=ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.bityield-auto-vault
NEXT_PUBLIC_SIMULATOR_CONTRACT=ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.velar-pool-simulator
```

### **Start Frontend**
```bash
cd ../frontend
npm run dev
```

## 🎭 **Demo Preparation**

### **1. Verify Real-Time Data**
```bash
# Check mainnet data is flowing
curl http://localhost:3001/api/oracle/comparison

# Should show:
# - Mainnet APY: 12.61%
# - Simulator APY: 12.61% (mirrored)
# - Accuracy: 100%
```

### **2. Test User Journey**
1. **Connect Wallet**: Use testnet wallet
2. **View Balance**: See testnet sBTC
3. **Auto-Invest**: Click "Auto-Invest 1.0 sBTC"
4. **Watch APY**: Live updates from mainnet
5. **View Strategy**: AI-generated allocation

### **3. Demo Talking Points**
- **"Real mainnet data"**: Show live 12.61% APY
- **"Live updates"**: Force oracle update during demo
- **"Zero risk"**: All on testnet
- **"Production ready"**: Easy mainnet migration

## 🔍 **Troubleshooting**

### **Common Issues**

#### **Clarinet Not Found**
```bash
# Install Clarinet
curl --proto '=https' --tlsv1.2 -sSf https://install.clarinet.so | sh
source ~/.bashrc
```

#### **Deployment Fails**
```bash
# Check Clarinet configuration
clarinet check

# Verify testnet settings
cat settings/testnet.toml
```

#### **Oracle Not Updating**
```bash
# Check oracle status
curl http://localhost:3001/api/oracle/status

# Force update
curl -X POST http://localhost:3001/api/oracle/force-update
```

#### **Frontend Connection Issues**
```bash
# Verify contract addresses
clarinet console
::get_contracts

# Update frontend .env.local with correct addresses
```

## 📊 **Monitoring During Demo**

### **Real-Time Dashboards**
```bash
# Oracle status
curl http://localhost:3001/api/oracle/status

# Mainnet data
curl http://localhost:3001/api/oracle/mainnet-data

# Simulator data
curl http://localhost:3001/api/oracle/simulator-data
```

### **Contract Interactions**
```bash
# Check vault TVL
clarinet console
(contract-call? .bityield-auto-vault get-total-tvl)

# Check pool info
(contract-call? .velar-pool-simulator get-pool-info)
```

## 🎊 **Success Indicators**

### **✅ Deployment Successful When:**
- All 3 contracts deployed without errors
- Oracle service running and updating
- Frontend connects to contracts
- Real mainnet APY (12.61%) displayed
- Auto-investment flow works end-to-end

### **✅ Demo Ready When:**
- Live APY updates every 5 minutes
- User can deposit and see strategy
- Real market data flowing from mainnet
- All API endpoints responding
- Frontend shows authentic data

## 🚀 **Go Live Checklist**

### **Pre-Demo (30 minutes before)**
- [ ] Deploy contracts to testnet
- [ ] Start oracle service
- [ ] Verify real-time data flow
- [ ] Test complete user journey
- [ ] Prepare demo wallet with testnet sBTC

### **During Demo**
- [ ] Show live mainnet APY (12.61%)
- [ ] Demonstrate auto-investment
- [ ] Force oracle update to show live changes
- [ ] Explain real data vs. simulator safety
- [ ] Highlight production-ready architecture

### **Demo Script**
1. **"This is real Velar mainnet data"** - Show 12.61% APY
2. **"Updated every 5 minutes"** - Show oracle status
3. **"Watch it change live"** - Force update
4. **"Zero risk on testnet"** - Explain safety
5. **"Production ready"** - Show mainnet migration path

---

**🎯 Your BitYield hackathon demo is now ready to impress judges with real mainnet data running safely on testnet!**

## 🆘 **Need Help?**

### **Quick Commands**
```bash
# Deploy everything
npm run deploy:simple

# Start oracle
cd ../backend && npm run start:oracle

# Start frontend
cd ../frontend && npm run dev

# Check status
curl http://localhost:3001/api/oracle/status
```

### **Emergency Reset**
```bash
# Redeploy contracts
npm run deploy:simple

# Restart oracle
curl -X POST http://localhost:3001/api/oracle/stop
curl -X POST http://localhost:3001/api/oracle/start

# Force data update
curl -X POST http://localhost:3001/api/oracle/force-update
```

**🚀 You're ready to win the hackathon with real mainnet data!**
