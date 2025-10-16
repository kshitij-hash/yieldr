# BitYield AI Backend

> **Status**: ✅ Production-ready with 106 passing integration tests
>
> **Latest Update**: Added comprehensive protocol testing, rate limiting, and real on-chain data integration (no mock data). See [BACKEND_COMPLETION_SUMMARY.md](./BACKEND_COMPLETION_SUMMARY.md) for details.

AI-powered sBTC yield optimization engine for the Stacks blockchain. This backend aggregates yield data from Zest Protocol, Velar DEX, and ALEX Protocol, using OpenAI GPT-4 to provide personalized yield recommendations.

## Features

- **Multi-Protocol Aggregation**: Fetches yield data from Zest, Velar, and ALEX
- **AI-Powered Recommendations**: Uses OpenAI GPT-4 with structured outputs (Zod schemas)
- **Fallback System**: Rule-based recommendations when AI is unavailable
- **Redis Caching**: Fast responses with intelligent cache management
- **Background Workers**: Automated yield data updates every 10 minutes
- **Type-Safe**: Full TypeScript with Zod validation
- **Comprehensive Testing**: Unit and integration tests with Vitest

## Architecture

```
backend/
├── src/
│   ├── config/          # Environment and logger config
│   ├── protocols/       # Protocol integrators (Zest, Velar, ALEX)
│   ├── ai/              # OpenAI and fallback recommenders
│   ├── cache/           # Redis caching layer
│   ├── types/           # TypeScript types and Zod schemas
│   ├── workers/         # Background data updater
│   └── server.ts        # Express API server
├── tests/               # Test files
└── package.json
```

## Setup

### Prerequisites

- Node.js 18+ or 20+
- Redis server running locally or remote
- OpenAI API key
- npm or yarn

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Environment Variables

Required variables in `.env`:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4o

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=development

# Stacks API
STACKS_API_URL=https://api.hiro.so
STACKS_NETWORK=mainnet
```

See `.env.example` for all available configuration options.

## Running the Application

### Development Mode

```bash
# Start the server with hot reload
npm run dev

# Server will start on http://localhost:3000
```

### Production Mode

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### Background Worker

The worker runs automatically when the server starts, but you can also run it standalone:

```bash
# Run worker separately
npm run worker
```

## API Endpoints

### POST /api/recommend

Get personalized yield recommendation based on user preferences.

**Request Body:**
```json
{
  "amount": 100000000,
  "riskTolerance": "moderate",
  "timeHorizon": "medium",
  "avoidImpermanentLoss": true,
  "minApy": 5,
  "maxLockPeriod": 7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "protocol": "zest",
    "poolId": "sbtc-pool-1",
    "poolName": "Zest sBTC Lending Pool",
    "expectedAPY": 8.5,
    "reasoning": "This Zest lending pool aligns with your moderate risk profile with strong liquidity ($15M TVL) offering flexible withdrawals without impermanent loss.",
    "riskAssessment": "Standard DeFi risks apply.",
    "alternatives": [...],
    "projectedEarnings": {
      "daily": 0.000233,
      "monthly": 0.00708,
      "yearly": 0.085
    },
    "confidenceScore": 0.8,
    "source": "ai"
  }
}
```

### GET /api/yields

Get all available yield opportunities across all protocols.

**Response:**
```json
{
  "success": true,
  "data": {
    "protocols": [
      {
        "protocol": "zest",
        "opportunities": [...],
        "totalTVL": 25000000,
        "fetchedAt": 1234567890
      }
    ],
    "totalOpportunities": 12,
    "totalTVL": 45000000,
    "highestAPY": {
      "protocol": "velar",
      "poolId": "sbtc-stx-pool",
      "apy": 22.5
    }
  }
}
```

### GET /api/yields/:protocol

Get yield opportunities for a specific protocol (zest, velar, or alex).

### GET /api/health

Health check endpoint showing system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "cache": { "status": "up", "latency": 2 },
      "ai": { "status": "up", "model": "gpt-4o" },
      "protocols": {
        "zest": "up",
        "velar": "up",
        "alex": "up"
      }
    },
    "dataFreshness": {
      "oldestData": 120
    }
  }
}
```

### DELETE /api/cache

Clear Redis cache (admin endpoint).

**Query Parameters:**
- `pattern` (optional): Cache key pattern to delete (e.g., "yield:*")

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:report
```

## How It Works

### 1. Data Aggregation

The system fetches yield data from three protocols:

- **Zest Protocol**: sBTC lending pools with supply APY, utilization rates, and TVL
- **Velar DEX**: sBTC liquidity pools with trading fees + VELAR token rewards
- **ALEX Protocol**: sBTC staking and yield farming with ALEX token rewards

### 2. Caching Strategy

- Data cached in Redis with 10-minute TTL
- Background worker refreshes data every 10 minutes
- Stale-while-revalidate pattern: return stale data while refreshing in background
- Cache keys: `yield:all-opportunities`, `yield:protocol:{protocol}`

### 3. AI Recommendation

**OpenAI GPT-4 Approach:**
1. Constructs detailed prompt with all yield opportunities and user preferences
2. Uses structured outputs with Zod schema for type-safe responses
3. AI analyzes risk-adjusted returns, fees, liquidity, and user profile
4. Returns primary recommendation + 2-3 alternatives with reasoning

**Fallback Rule-Based System:**
1. Filters opportunities by user preferences (risk, APY, lock period, etc.)
2. Scores using formula: `APY × log10(TVL) × risk_factor × preference_bonus`
3. Sorts by score and selects top option
4. Generates reasoning and alternatives deterministically

### 4. Response Flow

```
User Request
    ↓
API Endpoint
    ↓
Check Cache (Redis)
    ↓
If miss: Fetch from Protocols
    ↓
Try AI Recommendation
    ↓
If AI fails: Fallback System
    ↓
Return Recommendation
```

## Configuration

### Redis Configuration

```env
REDIS_URL=redis://localhost:6379
REDIS_TTL=600                    # 10 minutes
CACHE_REFRESH_INTERVAL=600000    # 10 minutes in ms
CACHE_STALE_THRESHOLD=1800000    # 30 minutes in ms
```

### AI Configuration

```env
AI_TEMPERATURE=0.3               # 0-2, lower = more deterministic
AI_MAX_TOKENS=1500               # Max response length
AI_FALLBACK_ENABLED=true         # Enable fallback system
```

### Safety Settings

```env
MAX_APY_THRESHOLD=1000           # Flag APYs above 1000%
MIN_TVL_FOR_RECOMMENDATION=1000000  # Minimum $1M TVL
```

## Production Deployment

### Prerequisites

1. Set up Redis server (managed service recommended: Redis Cloud, AWS ElastiCache, etc.)
2. Obtain OpenAI API key
3. Configure environment variables for production

### Deployment Steps

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Set production environment variables:**
   ```bash
   export NODE_ENV=production
   export OPENAI_API_KEY=your-key
   export REDIS_URL=redis://your-redis-url:6379
   # ... other variables
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Use process manager (PM2):**
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name bityield-backend
   pm2 save
   pm2 startup
   ```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
docker build -t bityield-backend .
docker run -p 3000:3000 --env-file .env bityield-backend
```

## Monitoring

### Logs

Logs are output to:
- Console (all environments)
- `logs/error.log` (production only)
- `logs/combined.log` (production only)

### Health Monitoring

Monitor the `/api/health` endpoint:
- Status: healthy / degraded / unhealthy
- Service status: cache, AI, protocols
- Data freshness: age of cached data

### Metrics to Track

- API response time
- Cache hit rate
- AI vs fallback usage
- Protocol fetch success rate
- Error rate by endpoint

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### OpenAI API Errors

- **429 Rate Limit**: Reduce request frequency or upgrade plan
- **401 Unauthorized**: Check API key in .env
- **503 Service Unavailable**: OpenAI downtime, fallback system activates automatically

### Data Staleness

If data is stale (older than 30 minutes):
1. Check background worker logs
2. Verify protocol API availability
3. Manually trigger cache refresh: `DELETE /api/cache`

### Memory Issues

```bash
# Monitor Node.js memory usage
pm2 monit

# Increase Node.js memory limit if needed
node --max-old-space-size=4096 dist/server.js
```

## Development

### Code Style

```bash
# Format code
npm run format

# Lint code
npm run lint
```

### Adding a New Protocol

1. Create protocol integration in `src/protocols/{protocol-name}.ts`
2. Implement `fetchYieldOpportunities()` method
3. Add protocol to `src/protocols/aggregator.ts`
4. Update `Protocol` enum in `src/types/yield.ts`
5. Add tests in `tests/`

### Adding New Endpoints

1. Add route in `src/server.ts`
2. Define request/response schemas in `src/types/`
3. Add tests in `tests/`
4. Update this README

## Performance

- **Cache hit response**: <50ms
- **Cache miss (with protocol fetch)**: 1-3 seconds
- **AI recommendation**: 2-5 seconds
- **Fallback recommendation**: <100ms

## Security

- ✅ Input validation with Zod schemas
- ✅ Environment variable validation
- ✅ Rate limiting (configurable)
- ✅ Error handling without sensitive data exposure
- ⚠️ Add authentication for production deployment
- ⚠️ Protect admin endpoints (`/api/cache`)

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: See DEPLOYMENT.md for deployment guide

## Acknowledgments

Built with:
- [OpenAI](https://openai.com/) - GPT-4 for AI recommendations
- [Redis](https://redis.io/) - Caching layer
- [Express](https://expressjs.com/) - Web framework
- [Zod](https://zod.dev/) - Schema validation
- [Stacks](https://www.stacks.co/) - Bitcoin L2 blockchain
- [Hiro API](https://www.hiro.so/) - Stacks blockchain API

---

**Built for BitYield** - AI-powered sBTC yield optimization
