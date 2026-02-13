# Backend Requirements & Architecture

## Executive Summary
Move from Python backend to unified Node.js/TypeScript backend with **provider-agnostic market data layer**. Initial implementation uses **Alpaca** (existing API keys) with flexibility to swap to Polygon.io or other providers without architectural changes.

---

## Current State
- **Frontend**: Next.js 14 + TypeScript + SQLite
- **Backend**: Python scripts (being retired)
- **Data Source**: Manual entry + limited live price updates
- **API Keys**: Alpaca (Basic/Plus tier available)

## Target State
- **Unified Stack**: Node.js/TypeScript for all APIs
- **Provider-Agnostic Data Layer**: Swap Alpaca ↔ Polygon via config
- **Real-Time Data**: WebSocket integration for live pricing
- **Database**: Turso (SQLite) — positions, trades, market cache
- **Deployment**: Single platform (Vercel/Railway/Render)

---

## Provider Comparison

| Feature | Alpaca Basic (Free) | Alpaca Plus ($99/mo) | Polygon ($199/mo) |
|---------|---------------------|----------------------|-------------------|
| **Stocks WebSocket** | 30 symbols (IEX) | Unlimited (all exchanges) | Unlimited |
| **Options WebSocket** | 200 quotes (indicative) | 1000 quotes (OPRA) | Unlimited |
| **Options Real-Time** | Indicative (delayed) | OPRA real-time | Real-time |
| **Stock Historical** | Last 15 min only | Since 2016, unlimited | 15+ years |
| **Options Historical** | None (or 15min) | Full historical | Full historical |
| **REST API Rate Limit** | 200 req/min | 10,000 req/min | Unlimited |
| **Best For** | Testing, small portfolios | Active options trading | Institutional, heavy API use |

### Recommendation
- **Start with Alpaca Plus ($99)** — sufficient for our needs, you already have keys
- **Upgrade to Polygon later** if we hit Alpaca limits or need better historical options data

---

## Provider-Agnostic Architecture

### Core Principle
All market data flows through an **abstract interface**. Switching providers = changing one config value + minor data mapping.

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
┌────────▼────────┐
│  MarketData     │ ◄── Abstract interface
│  Provider       │
│  (Interface)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼────┐ ┌────────┐
│Alpaca │ │Polygon │ │Mock    │
│Provider│ │Provider│ │Provider│
└────────┘ └────────┘ └────────┘
         │
┌────────▼────────┐
│  WebSocket      │
│  Manager        │
└─────────────────┘
```

### File Structure
```
/lib/market-data/
├── types.ts                    # Shared types (Quote, OptionSnapshot, etc.)
├── interface.ts                # IMarketDataProvider interface
├── factory.ts                  # Create provider from config
├── alpaca/
│   ├── client.ts              # Alpaca REST client
│   ├── websocket.ts           # Alpaca WebSocket manager
│   ├── provider.ts            # Alpaca implementation of interface
│   └── utils.ts               # Alpaca-specific helpers
├── polygon/
│   └── (future)               # Same structure as alpaca/
└── index.ts                   # Public API

/lib/db/
├── positions.ts
├── trades.ts
├── market-cache.ts            # Cache layer (provider-agnostic)
└── sync.ts                    # Background sync jobs
```

### Provider Interface
```typescript
// lib/market-data/interface.ts

export interface IMarketDataProvider {
  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Quotes & Snapshots
  getQuote(symbol: string): Promise<Quote>;
  getOptionChain(underlying: string): Promise<OptionSnapshot[]>;
  getSnapshot(symbol: string): Promise<StockSnapshot>;
  
  // Historical
  getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]>;
  
  // WebSocket Subscriptions
  subscribeQuotes(symbols: string[], callback: QuoteHandler): void;
  subscribeOptionQuotes(symbols: string[], callback: OptionQuoteHandler): void;
  unsubscribe(symbols: string[]): void;
  
  // Metadata
  getEarningsCalendar(start: Date, end: Date): Promise<EarningsEvent[]>;
  getOptionContracts(underlying: string): Promise<OptionContract[]>;
}

// Usage in API routes:
import { marketData } from '@/lib/market-data';
// marketData is singleton instance of IMarketDataProvider
```

### Configuration
```typescript
// lib/market-data/config.ts
export const marketDataConfig = {
  provider: process.env.MARKET_DATA_PROVIDER || 'alpaca', // 'alpaca' | 'polygon' | 'mock'
  
  alpaca: {
    apiKey: process.env.ALPACA_API_KEY!,
    apiSecret: process.env.ALPACA_API_SECRET!,
    paperTrading: process.env.ALPACA_PAPER === 'true',
    feed: 'opra', // 'opra' (real-time) or 'indicative'
  },
  
  polygon: {
    apiKey: process.env.POLYGON_API_KEY!,
    // ...polygon specific
  },
  
  // Limits for free tier compliance
  limits: {
    maxStockSubscriptions: 30,   // Alpaca Basic
    maxOptionSubscriptions: 200, // Alpaca Basic
    pollIntervalMs: 60000,       // Fallback polling
  }
};
```

---

## Alpaca-Specific Implementation Details

### Authentication
```typescript
// WebSocket auth via headers or message
const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/sip', {
  headers: {
    'APCA-API-KEY-ID': apiKey,
    'APCA-API-SECRET-KEY': apiSecret,
  }
});

// Or auth message (10 second window after connect):
ws.send(JSON.stringify({
  action: 'auth',
  key: apiKey,
  secret: apiSecret
}));
```

### WebSocket Stream URLs
| Data Type | URL |
|-----------|-----|
| Stocks (IEX, free) | `wss://stream.data.alpaca.markets/v2/iex` |
| Stocks (all, paid) | `wss://stream.data.alpaca.markets/v2/sip` |
| Options | `wss://stream.data.alpaca.markets/v1beta1/opra` |
| Test Stream | `wss://stream.data.alpaca.markets/v2/test` |

### Message Formats

**Stock Quote:**
```json
{
  "T": "q",
  "S": "AAPL",
  "bx": "N",
  "bp": 150.25,
  "bs": 100,
  "ax": "N", 
  "ap": 150.30,
  "as": 50,
  "t": "2024-01-15T09:30:00.000Z"
}
```

**Option Trade (msgpack binary):**
```
T: "t" (trade)
S: "AAPL240315C00172500" (OCC option symbol)
p: 2.84 (price)
s: 1 (size)
t: "2024-03-11T13:35:35.133Z"
```

### Option Symbol Format
Alpaca uses **OCC standard**:
- Format: `{UNDERLYING}{YY}{MM}{DD}{C/P}{STRIKE}`
- Example: `AAPL240315C00172500` = AAPL 2024-03-15 Call $172.50

We need to map our internal format ↔ OCC format.

---

## Data Requirements by Feature (Provider-Agnostic)

### 1. Positions & Portfolio
| Data Need | Source | Frequency | Strategy |
|-----------|--------|-----------|----------|
| Underlying price | WebSocket | Real-time | Subscribe to position underlyings |
| Option bid/ask | WebSocket | Real-time | Subscribe to option symbols |
| Intraday P&L | Computed | On every quote | Calculate from entry vs current |
| Greeks/IV | Snapshot API | Hourly | Fetch and cache for IV rank |

### 2. Market Context Panel
| Data Need | Source | Frequency | Strategy |
|-----------|--------|-----------|----------|
| IV Rank | Snapshots + historical | Hourly | Build 52-week IV history locally |
| Earnings | Earnings API | Daily | Cache 30 days out |
| VIX | WebSocket/REST | Real-time | Single symbol subscription |
| Sector performance | Grouped bars | Daily | Cache end-of-day |

### 3. Screener & Watchlist
| Data Need | Source | Frequency | Strategy |
|-----------|--------|-----------|----------|
| High IV scan | Option snapshots | Hourly | Scan ~100 popular options chains |
| Volume spikes | Trade data | Real-time | Subscribe to high-volume symbols |
| Earnings plays | Earnings API | Daily | Cross with high IV list |

---

## Database Schema (Provider-Agnostic)

### Core Tables (Already Exist)
- `positions` — add `option_symbol` field (OCC format)
- `trades`, `assignments` — unchanged

### New Tables
```sql
-- Market data cache (generic, provider-agnostic)
CREATE TABLE market_data_cache (
    cache_key TEXT PRIMARY KEY,      -- e.g., "quote:AAPL"
    provider TEXT NOT NULL,          -- "alpaca", "polygon"
    data_type TEXT NOT NULL,         -- "quote", "snapshot", "greek"
    symbol TEXT NOT NULL,
    data_json TEXT NOT NULL,         -- Provider-specific JSON
    fetched_at DATETIME,
    expires_at DATETIME,             -- TTL for cache invalidation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cache_expires ON market_data_cache(expires_at);
CREATE INDEX idx_cache_symbol ON market_data_cache(symbol, data_type);

-- IV history for IV rank calculation (provider-agnostic)
CREATE TABLE iv_history (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,            -- Underlying ticker
    option_symbol TEXT,              -- Specific option (if per-strike)
    iv_value REAL NOT NULL,
    iv_rank_52w REAL,                -- Computed weekly
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, DATE(recorded_at))
);

CREATE INDEX idx_iv_symbol_date ON iv_history(symbol, recorded_at);

-- Earnings calendar cache (provider-agnostic)
CREATE TABLE earnings_cache (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    report_date TEXT NOT NULL,
    report_time TEXT,                -- "beforemkt", "aftermkt", "during"
    estimated_eps REAL,
    actual_eps REAL,                 -- Updated post-report
    surprise_pct REAL,
    provider TEXT,                   -- Source: "alpaca", "polygon", "manual"
    cached_at DATETIME,
    UNIQUE(symbol, report_date)
);

-- Subscription management (track what we're subscribed to)
CREATE TABLE active_subscriptions (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,            -- Stock or option symbol
    symbol_type TEXT NOT NULL,       -- "stock", "option"
    provider TEXT NOT NULL,
    subscribed_at DATETIME,
    last_message_at DATETIME,
    error_count INTEGER DEFAULT 0,
    UNIQUE(provider, symbol)
);
```

---

## WebSocket Architecture

### The Challenge
Next.js App Router **does not support** persistent WebSocket servers (stateless serverless functions). Solutions:

### Option 1: Smart Polling (Recommended for Start)
Use SWR/React Query with intelligent polling:

```typescript
// Client-side hook using SWR
function useLivePrices(symbols: string[]) {
  return useSWR(
    ['/api/market/quotes', symbols],
    fetcher,
    {
      refreshInterval: 60000,           // 60s default
      refreshIntervalWhenVisible: 10000, // 10s when tab active
      refreshIntervalWhenHidden: 300000, // 5min when background
    }
  );
}
```

**Pros:** Works on Vercel, simple, no state management
**Cons:** 10-60s latency vs true real-time

### Option 2: Server-Sent Events (SSE)
One-way server → client streaming:

```typescript
// app/api/market/stream/route.ts
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to provider WebSocket
      // Forward messages to SSE
    }
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

**Pros:** Near real-time, works on most platforms
**Cons**: One-way only, connection limits on serverless

### Option 3: Separate WebSocket Server (For True Real-Time)
Deploy Node.js WebSocket server alongside Next.js:

```
Deployment:
├── Next.js App (Vercel)     → UI, REST APIs
├── WebSocket Server (Railway) → Real-time data hub
└── Redis (Upstash)          → Pub/sub between them
```

**Pros:** True real-time, works with Alpaca/Polygon natively
**Cons:** More complex, higher cost, need to manage state

### Our Approach
**Phase 1:** Smart polling + manual refresh buttons
**Phase 2:** Add SSE for active position view (optional)
**Phase 3:** Separate WebSocket server if trading frequency demands it

---

## API Route Structure

```
/app/api/
├── positions/
│   ├── route.ts                    # GET all, POST new
│   ├── [id]/
│   │   ├── route.ts               # GET, PUT, DELETE single
│   │   ├── close/route.ts         # Close position
│   │   └── roll/route.ts          # Roll position
│   └── live/route.ts              # GET live prices for positions
├── portfolio/
│   └── summary/route.ts           # GET portfolio metrics
├── market/
│   ├── quotes/route.ts            # POST {symbols} → get quotes
│   ├── options/
│   │   ├── chain/route.ts         # GET option chain for underlying
│   │   └── snapshot/route.ts      # GET option snapshot by symbol
│   ├── iv-rank/route.ts           # GET IV rank for ticker
│   ├── earnings/route.ts          # GET earnings calendar
│   └── screener/route.ts          # POST criteria → scan results
├── trades/
│   ├── history/route.ts
│   ├── performance/route.ts
│   └── filters/route.ts
├── agent/
│   ├── approvals/route.ts
│   ├── actions/route.ts
│   └── tasks/route.ts
└── webhooks/
    └── (optional for provider callbacks)
```

---

## Milestones (Revised)

### Milestone 1: Provider-Agnostic Foundation (Week 1)
- [ ] Create `lib/market-data/` structure with interface + types
- [ ] Implement Alpaca REST client + authentication
- [ ] Build `/api/market/quotes` endpoint (polling-based)
- [ ] Create `market_data_cache` table for caching
- [ ] Test with your Alpaca keys

**Deliverable:** Can fetch live AAPL, SPY quotes via our API

### Milestone 2: WebSocket Integration (Week 2)
- [ ] Implement Alpaca WebSocket manager in Node.js
- [ ] Build subscription manager (respect 30 stock / 200 option limit)
- [ ] Create client-side hook for live prices (SWR-based)
- [ ] Add `/api/market/stream` SSE endpoint (optional)
- [ ] Update positions to store OCC option symbols

**Deliverable:** Portfolio updates every 10-60s with live prices

### Milestone 3: Live P&L + Portfolio (Week 3)
- [ ] Real-time P&L calculation from quote updates
- [ ] Integrate live prices into `/api/portfolio/summary`
- [ ] Update frontend to consume live data
- [ ] Add manual refresh button for instant update
- [ ] Cache layer for expensive calculations

**Deliverable:** Portfolio shows accurate live P&L

### Milestone 4: Market Context Panel (Week 4)
- [ ] IV rank calculator using historical IV snapshots
- [ ] Earnings calendar integration
- [ ] Macro data (VIX, sector performance)
- [ ] Strategy suggestions engine

**Deliverable:** Market Context panel fully populated

### Milestone 5: Screener + Production (Week 5-6)
- [ ] Options screener (high IV, earnings plays)
- [ ] Watchlist with alerts
- [ ] Deploy to production
- [ ] Monitoring & error handling

**Deliverable:** Production-ready dashboard with live data

---

## Cost Analysis (Revised)

### Alpaca Plus Tier (Recommended)
- **Monthly**: $99
- Annual: $990 (save $198)
- 
### Infrastructure
- Vercel Pro: $20/mo (or free tier)
- Turso: Free (10GB) → $9/mo (100GB)
- Redis (if needed): Upstash free tier

### Total Monthly
- **With Plus**: $99 + $20 = **$119/mo**
- **With Plus + Turso**: $99 + $20 + $9 = **$128/mo**

**Versus Polygon**: Save ~$100/mo initially. Upgrade if we hit limits.

---

## Key Technical Decisions

### 1. Provider Abstraction
**Why:** Gives us escape hatch. If Alpaca limits us, swap to Polygon in <1 day.
**How:** Interface pattern + factory method. All code uses `IMarketDataProvider`, never provider-specific types.

### 2. OCC Option Symbol Format
**Why:** Standard across Alpaca, Polygon, most brokers
**Mapping:**
- Internal: `{ticker} {expiration} {call/put} {strike}`
- OCC: `{TICKER}{YY}{MM}{DD}{C/P}{STRIKE_PADDED}`
- Example: `AAPL 240315 C 172.5` → `AAPL240315C00172500`

### 3. Polling Over WebSocket (For Now)
**Why:** Works on Vercel serverless, simpler, sufficient for our use case
**Hybrid:** WebSocket on backend (to Alpaca), polling on frontend (from our API)

### 4. msgpack for Options
**Why:** Alpaca requires msgpack (binary) for options WebSocket
**Strategy:** Use `@msgpack/msgpack` library, decode in WebSocket manager

---

## Open Questions / Decisions Needed

1. **Alpaca tier**: Stick with Basic (free) for testing or jump to Plus ($99)?
2. **Polling intervals**: 60s background / 10s active feels right?
3. **IV calculation**: Fetch 52-week history once, update daily, or real-time calc?
4. **Earnings data**: Alpaca's is limited — supplement with Yahoo Finance scraping?
5. **Provider priority**: Alpaca first, Polygon as backup, or parallel?

---

## Next Steps

1. ✅ **This doc approved?** — Any changes to architecture?
2. 🔑 **API credentials** — Can you share Alpaca key/secret (read-only)?
3. 🚀 **Milestone 1 kickoff** — I can start building the provider layer today

Ready to build. 🎯
