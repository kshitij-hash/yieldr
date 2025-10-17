# Yieldr

> **AI-powered sBTC yield optimization on Stacks. Maximize returns, minimize complexity.**

<div align="center">

[![Status](https://img.shields.io/badge/Status-Beta-orange)]()
[![Tests](https://img.shields.io/badge/Tests-143%2F145%20Passing-brightgreen)]()
[![Clarity](https://img.shields.io/badge/Clarity-v3-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-black)]()

</div>

---

## What is Yieldr?

Bitcoin holders want their assets to work for them, but navigating DeFi on Stacks can be overwhelming. Which protocol should you trust? How much should you allocate to each pool? When should you rebalance?

Yieldr solves this by being your smart vault for sBTC. Think of it as an autopilot for yield optimization - deposit your sBTC, and our AI figures out the best way to allocate it across different protocols like ALEX and Velar to maximize your returns.

## How It Works

1. **Deposit sBTC** - Connect your wallet and deposit any amount of sBTC
2. **Choose Your Strategy** - Pick conservative, moderate, or aggressive risk preference
3. **AI Recommends** - Our AI analyzes current yields across protocols and suggests optimal allocation
4. **One-Click Rebalance** - Approve the recommendation and your funds are allocated automatically
5. **Withdraw Anytime** - No lock-ups, withdraw whenever you want

Instead of juggling multiple DeFi protocols and constantly monitoring APYs, you get a single dashboard that shows your total balance, current yield, and AI-powered recommendations for when to rebalance.

---

## Key Features

### AI-Powered Recommendations
Our system uses OpenAI to analyze real-time yield data from multiple protocols and recommend the best allocation for your risk preference. You can choose between conservative (safer, steady returns), moderate (balanced), or aggressive (higher risk, higher potential returns).

### Non-Custodial
Your sBTC never leaves your control. Everything happens through smart contracts on the Stacks blockchain. We can't access your funds - only you can deposit, withdraw, or approve rebalancing.

### Real-Time Data
We track APYs from ALEX and Velar protocols in real-time, updating every 10 minutes so you always have current information when making decisions.

### Simple Dashboard
A clean interface shows your total balance, current yield, and historical performance. Deposit, withdraw, or rebalance with just a few clicks.


---

## Technical Stack

### Smart Contracts
Built with Clarity 3 on the Stacks blockchain. The main vault contract handles deposits, withdrawals, and rebalancing logic. We've written 143 tests to ensure everything works correctly.

### Backend
A Node.js API that fetches real-time yield data from protocols, caches it with Redis for fast responses, and uses OpenAI to generate allocation recommendations based on current market conditions.

### Frontend
Next.js 15 web app with a clean interface for connecting your wallet, viewing your balance, and managing your vault. Works with any Stacks wallet (Hiro, Xverse, Leather).

---

## Development

To run Yieldr locally, you'll need Node.js, Redis, and Clarinet installed.

```bash
# Clone and install
git clone https://github.com/your-org/yieldr.git
cd yieldr
npm install

# Start backend (Terminal 1)
cd packages/backend
cp .env.example .env  # Add your OpenAI API key
npm run dev

# Start frontend (Terminal 2)
cd packages/frontend
npm run dev

# Visit http://localhost:3000
```

For contract development, see the `/packages/contracts` README.

---

## Deployment

Currently running on Stacks testnet. The contracts are deployed and we're testing with real users before moving to mainnet.

- **Contracts**: Deployed on Stacks testnet
- **Backend**: Running on GCP
- **Frontend**: Hosted on Vercel

For detailed deployment instructions, see the deployment guide in the repo.

---

## Project Structure

```
yieldr/
├── packages/
│   ├── contracts/       # Smart contracts (Clarity)
│   ├── backend/         # API server (Node.js + Express)
│   └── frontend/        # Web app (Next.js)
├── README.md
└── package.json
```

---

## Roadmap

### Currently Working On
- Testing on Stacks testnet
- Gathering feedback from early users
- Fixing bugs and improving the UI

### What's Next
- Security audit of smart contracts
- Add support for more protocols (Bitflow, Stackswap)
- Improve AI recommendation accuracy
- Better mobile experience

### Future Ideas
- Mainnet launch (after thorough testing and audit)
- Auto-compounding strategies
- Support for other tokens beyond sBTC
- Mobile app

---

## Security

**Important: This is beta software on testnet.** The smart contracts have not been professionally audited yet. Use at your own risk.

What we've done so far:
- Written 143 tests for the smart contracts
- Added emergency pause functionality
- Made everything non-custodial (you control your funds)
- Open-sourced the code so anyone can review it

We plan to get a professional security audit before launching on mainnet.

---

## FAQ

**Is Yieldr custodial?**
No. Your sBTC stays in smart contracts that only you control. We can't access your funds.

**What's the minimum deposit?**
Currently 0.001 sBTC. There's no maximum.

**Can I lose money?**
Yes. DeFi has risks including smart contract bugs, market volatility, and protocol failures. Only deposit what you can afford to lose.

**How often should I rebalance?**
Our AI will recommend rebalancing when it detects better opportunities, usually every few weeks depending on market conditions.

**Is there a lock-up period?**
No. You can withdraw anytime.

**What wallets work with Yieldr?**
Any Stacks wallet - Hiro, Xverse, or Leather.

---

**⚠️ Risk Disclaimer**: Yieldr is beta software on testnet. Smart contracts have not been audited. Use at your own risk. This is not financial advice.
