# Backend Requirements & Architecture

## Executive Summary
Move from Python backend to unified Node.js/TypeScript backend using Polygon.io for all market data. This consolidates the stack, simplifies deployment, and gives us real-time options data with a single vendor.

---

## Current State
- **Frontend**: Next.js 14 + TypeScript + SQLite (local Turso pending)
- **Backend**: Python scripts for position tracking, market data fetchers
- **Data Source**: Manual entry + limited live price updates
- **Gap**: No unified API layer, no real-time market data feed

## Target State
- **Unified Stack**: Node.js/TypeScript for frontend + backend APIs
- **Data Provider**: Polygon.io (Options + Stocks + Forex data)
- **Database**: Turso (SQLite) for positions, trades, journal
- **Cache**: Redis (optional, for rate limiting + session data)
- **Deployment**: Single Vercel/Render/Railway deployment

---

## Data Requirements by Feature

### 1. Positions & Portfolio
| Data Need | Polygon Endpoint | Frequency | Storage |
|-----------|-----------------|-----------|---------|
| Underlying price | `/v2/aggs/ticker/{ticker}/prev` | Real-time (WebSocket) | Cache (5min) |
| Option Greeks/IV | `/v3/snapshot/options/{underlying}` | Real-time | Cache (1min) |
| Option bid/ask | WebSocket: `O.{ticker}` | Real-time | No storage |
| Position P&L calc | Computed from above | On-demand | SQLite computed column |
| DTE | Computed from exp date | Real-time | SQLite computed column |

### 2. Market Context Panel
| Data Need | Polygon Endpoint | Frequency | Storage |
|-----------|-----------------|-----------|---------|
| IV Rank/IV Percentile | `/v3/snapshot/options/{ticker}` | Hourly | SQLite (cache 1hr) |
| Earnings calendar | Polygon upcoming earnings API | Daily | SQLite (cache 24hr) |
| VIX level | `/v2/aggs/ticker/VIX/prev` | Real-time | Cache only |
| Sector performance | `/v2/aggs/grouped` | Daily | Cache only |

### 3. Trade Journal
| Data Need | Source | Frequency | Storage |
|-----------|--------|-----------|---------|
| Trade history | Internal SQLite | On write | SQLite |
| Strategy performance | Computed from trades | On-demand | Computed |
| Assignment history | Internal SQLite | On write | SQLite |

### 4. Screener & Watchlist
| Data Need | Polygon Endpoint | Frequency | Storage |
|-----------|-----------------|-----------|---------|
| High IV rank scan | `/v3/reference/options/contracts` | Hourly | SQLite (cache) |
| Volume/OI spikes | `/v3/snapshot/options/{ticker}` | Hourly | SQLite (cache) |
| Earnings plays | Upcoming earnings | Daily | SQLite (cache) |

---

## API Architecture

### Route Structure
```
/app/api/
├── positions/
│   ├── route.ts (CRUD)
│   ├── [id]/
│   │   ├── route.ts (PUT/DELETE)
│   │   ├── close/route.ts
│   │   └── roll/route.ts
│   └── live-prices/route.ts
├── portfolio/
│   └── summary/route.ts
├── market/
│   ├── iv-ranks/route.ts
│   ├── earnings/route.ts
│   ├── macro/route.ts
│   └── screen/route.ts (new)
├── trades/
│   ├── history/route.ts
│   ├── performance/route.ts
│   └── filters/route.ts
├── agent/
│   ├── approvals/route.ts
│   ├── actions/route.ts
│   └── tasks/route.ts
└── webhooks/
    └── polygon/route.ts (real-time updates)
```

### Data Layer Pattern
```typescript
// lib/data/polygon.ts - Polygon client wrapper
// lib/db/
//   ├── positions.ts - Position CRUD
//   ├── trades.ts - Trade/journal CRUD
//   ├── market-cache.ts - Cached market data
//   └── sync.ts - Polygon → SQLite sync jobs
```

---

## Polygon.io Integration

### Subscription Tier
**Recommended**: Business ($199/mo) for:
- 15+ years historical options data
- Unlimited API calls
- WebSocket access (real-time options quotes)
- 1000 WebSocket connections

**Alternative**: Starter ($99/mo) if budget tight:
- 5 years historical
- 100k API calls/day
- Stocks/ETFs real-time
- Options delayed 15min

### Required Data Feeds
1. **Option Trades & Quotes** (WebSocket)
2. **Stocks Trades & Quotes** (WebSocket for underlying)
3. **Reference Data** (contracts info)
4. **Corporate Actions** (splits, dividends)

### API Rate Limits
- REST: 100 req/min (Starter), unlimited (Business)
- WebSocket: 100 msg/sec per connection
- Plan for caching to minimize API calls

---

## Database Schema Updates

### New Tables
```sql
-- Market data cache
CREATE TABLE market_cache (
    key TEXT PRIMARY KEY,
    data TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Options snapshots (for IV rank calc)
CREATE TABLE options_snapshots (
    id INTEGER PRIMARY KEY,
    underlying TEXT NOT NULL,
    option_ticker TEXT NOT NULL,
    strike REAL NOT NULL,
    expiration_date TEXT NOT NULL,
    iv REAL,
    greeks TEXT, -- JSON: delta, gamma, theta, vega
    bid REAL,
    ask REAL,
    snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_options_snapshots_underlying ON options_snapshots(underlying, snapshot_at);

-- IV rank history (for IV rank calc)
CREATE TABLE iv_rank_history (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    date TEXT NOT NULL,
    iv_52_week_high REAL,
    iv_52_week_low REAL,
    current_iv REAL,
    UNIQUE(ticker, date)
);

-- Earnings calendar cache
CREATE TABLE earnings_cache (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    report_date TEXT NOT NULL,
    report_time TEXT, -- "before_open", "after_close", "during_session"
    estimated_eps REAL,
    fiscal_quarter TEXT,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, report_date)
);
```

---

## WebSocket Architecture

### Server-Side (Next.js Route Handler)
Since Next.js App Router doesn't support persistent WebSocket servers, we'll use:

**Option A**: Polling with SWR/React Query (simplest)
- 30-60 second polling for non-critical data
- User-triggered refresh for active trading

**Option B**: Server-Sent Events (SSE)
- One-way server → client for price updates
- Good for live P&L updates

**Option C**: Separate WebSocket server (if real-time is critical)
- Node.js ws server on separate port/process
- Render/Railway can run both

### Recommendation
Start with **Option A + smart polling**:
- 60s polling for portfolio (background)
- 10s polling when actively viewing position
- Manual refresh button for immediate updates

Add SSE later if latency becomes an issue.

---

## Milestones

### Milestone 1: Polygon Setup + Basic Market Data (Week 1)
- [ ] Sign up for Polygon Business plan
- [ ] Create `lib/data/polygon.ts` client with API key management
- [ ] Build `/api/market/quotes` - fetch underlying prices
- [ ] Build `/api/market/options/snapshot` - fetch option chains
- [ ] Add WebSocket connection manager (optional for now)

**Deliverable**: Can fetch live SPY, QQQ, VIX quotes. API tested with curl.

### Milestone 2: Portfolio Live Pricing (Week 2)
- [ ] Update positions to store `option_ticker` (Polygon format)
- [ ] Build price sync job: Polygon → position current prices
- [ ] Real-time P&L calculation using Polygon mid prices
- [ ] Update `/api/portfolio/summary` with live data
- [ ] Update `/api/positions/live-prices` endpoint

**Deliverable**: Portfolio shows live P&L with actual market prices.

### Milestone 3: Market Context Panel (Week 3)
- [ ] Build IV rank calculator from options snapshots
- [ ] Earnings calendar API integration
- [ ] Macro snapshot (VIX, sector performance)
- [ ] Strategy suggestions based on IV rank filters
- [ ] Cache layer for expensive calculations

**Deliverable**: Market Context panel populated with live data.

### Milestone 4: Screener & Watchlist (Week 4)
- [ ] Build options scanner (high IV, earnings plays)
- [ ] Volume/OI spike detection
- [ ] Watchlist management with price alerts
- [ ] Alert system (in-app + push)

**Deliverable**: Can scan for new trade opportunities.

### Milestone 5: Automation & Polish (Week 5-6)
- [ ] Deploy to production (Vercel + Turso)
- [ ] Add Redis caching layer (if needed)
- [ ] Background jobs for data sync
- [ ] Error handling & retries for Polygon API
- [ ] WebSocket upgrade (if polling proves insufficient)

**Deliverable**: Production-ready trading dashboard.

---

## Cost Analysis

### Polygon.io Business Plan
- **Monthly**: $199
- **Annual**: $1,990 (save $398)

### Infrastructure
- **Vercel Pro**: $20/mo (or free tier with limits)
- **Turso**: Free tier (10GB) → $9/mo for 100GB
- **Redis (optional)**: Redis Cloud free tier → $30/mo

### Total Monthly
- **Starter stack**: $199 + $20 = **$219/mo**
- **Full stack**: $199 + $20 + $9 + $30 = **$258/mo**

---

## Technical Decisions

### Why Node.js over Python?
- ✅ Single codebase (TypeScript everywhere)
- ✅ Easier deployment (one Docker image or Vercel)
- ✅ Same team can work frontend + backend
- ✅ Native JSON handling for market data
- ✅ Better Vercel/Serverless integration

### Why Polygon.io?
- ✅ Industry standard for options data
- ✅ Clean REST + WebSocket APIs
- ✅ Good TypeScript SDK support
- ✅ Historical + real-time in one
- ✅ Competitive pricing vs Bloomberg/Refinitiv

### WebSocket vs Polling?
- **Start with polling** - simpler, works on Vercel
- **Move to WebSocket** only if we need sub-second updates for active trading

---

## Open Questions

1. Do we need real-time WebSocket quotes or is 30-60s polling enough?
2. Should we cache historical options data locally or fetch on-demand?
3. Do we need multi-leg strategy support (spreads, iron condors) in scanner?
4. Priority: Earnings plays vs high IV rank vs volume spikes?
5. Any compliance requirements (audit logs, data retention)?

---

## Next Steps

1. **Get Polygon key**: Sign up and share read-only API key
2. **Review this doc**: Any changes or additions?
3. **Milestone kickoff**: I can start Milestone 1 immediately
4. **Cleanup**: Merge final frontend fixes, then switch to backend branch

Ready when you are. 🚀
