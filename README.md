# BitYield Monorepo

AI-powered sBTC yield optimization platform on the Stacks blockchain.

## Project Structure

This is a monorepo containing three main packages:

```
bityield-monorepo/
├── packages/
│   ├── contracts/          # Smart contracts (Clarity)
│   ├── backend/           # Node.js API server
│   └── frontend/          # Next.js web application
├── package.json           # Root workspace configuration
└── README.md             # This file
```

## Packages

### 📄 Contracts (`packages/contracts`)

Smart contracts for the BitYield vault, written in Clarity for the Stacks blockchain.

**Features:**
- sBTC deposit/withdrawal functionality
- Real token transfers via SIP-010 standard
- Emergency pause mechanism
- Balance and TVL tracking
- Fuzz testing with Rendezvous

**Tech Stack:** Clarinet, Clarity 3, Vitest

[View Package README](./packages/contracts/README.md)

### 🔌 Backend (`packages/backend`)

AI-powered yield optimization API server.

**Features:**
- AI-driven portfolio recommendations
- Real-time protocol data aggregation
- Risk scoring and analysis
- Redis caching layer
- RESTful API

**Tech Stack:** Node.js, Express, TypeScript, OpenAI, Redis

[View Package README](./packages/backend/README.md)

### 🎨 Frontend (`packages/frontend`)

Modern web interface for BitYield.

**Features:**
- Stacks wallet integration
- Real-time portfolio tracking
- Responsive design with Tailwind CSS
- Dark mode support

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui

[View Package README](./packages/frontend/README.md)

## Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- Clarinet 2.0+
- Redis (for backend development)

### Installation

Install all dependencies across all packages:

```bash
npm install
```

### Development

Run all services in development mode:

```bash
# Run backend + frontend
npm run dev

# Or run individual packages
npm run dev:contracts    # Run contract tests in watch mode
npm run dev:backend      # Start backend server
npm run dev:frontend     # Start Next.js dev server
```

### Testing

Run tests across all packages:

```bash
npm test

# Or test individual packages
npm run test:contracts
npm run test:backend
```

### Building

Build all packages:

```bash
npm run build

# Or build individual packages
npm run build:contracts
npm run build:backend
npm run build:frontend
```

## Package-Specific Commands

### Contracts

```bash
cd packages/contracts

# Check contract syntax
clarinet check

# Run tests
npm test

# Run tests with coverage
npm run test:report

# Generate deployment plan
npm run deploy:generate

# Deploy to testnet
npm run deploy:testnet
```

### Backend

```bash
cd packages/backend

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Frontend

```bash
cd packages/frontend

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Workspace Management

This monorepo uses npm workspaces for dependency management.

### Install a dependency in a specific package:

```bash
npm install <package> --workspace=packages/<workspace-name>

# Examples:
npm install axios --workspace=packages/backend
npm install react-query --workspace=packages/frontend
```

### Clean everything:

```bash
npm run clean
```

## Architecture

### Contracts Layer
- Manages sBTC deposits/withdrawals
- Implements vault logic
- Deployed on Stacks blockchain

### Backend Layer
- Provides REST API for portfolio recommendations
- Aggregates protocol data
- Implements AI-driven yield optimization
- Caches data in Redis

### Frontend Layer
- User interface for wallet interaction
- Portfolio visualization
- Protocol discovery
- Transaction management

## Environment Setup

### Backend Environment Variables

Create `packages/backend/.env`:

```env
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=your_openai_key
STACKS_NETWORK=testnet
```

### Frontend Environment Variables

Create `packages/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_SBTC_CONTRACT=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
NEXT_PUBLIC_VAULT_CONTRACT=your_deployed_contract
```

## Deployment

### Contracts (Testnet)

```bash
cd packages/contracts
clarinet deployments generate --testnet
clarinet deployments apply --testnet
```

### Backend

```bash
cd packages/backend
npm run build
npm start
```

### Frontend

```bash
cd packages/frontend
npm run build
npm start
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Build all packages: `npm run build`
5. Submit a pull request

## Documentation

- [Contracts Documentation](./packages/contracts/README.md)
- [Backend Documentation](./packages/backend/README.md)
- [Frontend Documentation](./packages/frontend/README.md)
- [Claude Code Guidelines](./CLAUDE.md)
- [Testing Guide](./packages/contracts/testing/README.md)

## Tech Stack Summary

| Layer | Technologies |
|-------|-------------|
| Contracts | Clarity 3, Clarinet, Vitest, Rendezvous |
| Backend | Node.js, Express, TypeScript, OpenAI, Redis, Winston |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Blockchain | Stacks, sBTC, SIP-010 |

## License

MIT

## Project Status

- ✅ Smart Contracts: Complete & Ready for Deployment
- ✅ Backend: Complete & Production Ready
- ✅ Frontend: Complete & Production Ready
- 🚀 Status: Ready for Testnet Deployment
