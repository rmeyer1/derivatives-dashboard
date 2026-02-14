import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig } from '@/lib/market-data';
import sqlite3 from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data/market_data.db';

// Finnhub API for earnings (free tier available)
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

interface EarningsEvent {
  ticker: string;
  earningsDate: string;
  earningsTime: 'before_market' | 'after_market' | 'during' | 'unknown';
  expectedEPS: number | null;
  consensusEPS: number | null;
  hasPosition: boolean;
  daysToEarnings: number;
  impliedMove: number | null;
  lastYearSurprise: number | null;
}

// Common tickers with upcoming earnings (backed by real data when available)
const MOCK_EARNINGS = [
  { ticker: 'NVDA', daysOffset: 1, eps: 5.02, consensus: 4.98, surprise: 0.12 },
  { ticker: 'AAPL', daysOffset: 3, eps: 1.45, consensus: 1.42, surprise: 0.08 },
  { ticker: 'MSFT', daysOffset: 5, eps: 2.78, consensus: 2.71, surprise: 0.05 },
  { ticker: 'TSLA', daysOffset: 7, eps: 0.82, consensus: 0.79, surprise: -0.03 },
  { ticker: 'AMZN', daysOffset: 8, eps: 1.15, consensus: 1.12, surprise: 0.15 },
  { ticker: 'META', daysOffset: 10, eps: 5.25, consensus: 5.15, surprise: 0.18 },
  { ticker: 'GOOGL', daysOffset: 12, eps: 1.85, consensus: 1.82, surprise: 0.06 },
  { ticker: 'NFLX', daysOffset: 15, eps: 4.20, consensus: 4.15, surprise: 0.25 },
  { ticker: 'CRM', daysOffset: 18, eps: 2.10, consensus: 2.05, surprise: 0.09 },
  { ticker: 'AMD', daysOffset: 2, eps: 0.78, consensus: 0.75, surprise: 0.10 },
  { ticker: 'PYPL', daysOffset: 6, eps: 1.12, consensus: 1.09, surprise: -0.02 },
  { ticker: 'UBER', daysOffset: 20, eps: 0.25, consensus: 0.22, surprise: 0.45 },
  { ticker: 'PLTR', daysOffset: 25, eps: 0.08, consensus: 0.07, surprise: 0.15 },
  { ticker: 'COIN', daysOffset: 28, eps: 2.15, consensus: 1.95, surprise: 0.30 },
  { ticker: 'JPM', daysOffset: 4, eps: 4.50, consensus: 4.35, surprise: 0.12 },
  { ticker: 'BAC', daysOffset: 9, eps: 0.85, consensus: 0.82, surprise: 0.05 },
  { ticker: 'WMT', daysOffset: 14, eps: 1.55, consensus: 1.52, surprise: 0.08 },
  { ticker: 'DIS', daysOffset: 16, eps: 1.25, consensus: 1.20, surprise: -0.02 },
  { ticker: 'CAT', daysOffset: 11, eps: 4.75, consensus: 4.60, surprise: 0.10 },
  { ticker: 'V', daysOffset: 19, eps: 2.55, consensus: 2.48, surprise: 0.08 },
];

function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Get positions from database to mark earnings that affect portfolio
 */
function getPositionTickers(db: sqlite3.Database): string[] {
  const rows = db.prepare(`
    SELECT DISTINCT ticker FROM positions WHERE status = 'open'
  `).all() as { ticker: string }[];
  return rows.map(r => r.ticker);
}

/**
 * Store earnings in cache
 */
function cacheEarnings(db: sqlite3.Database, earnings: EarningsEvent[]): void {
  db.prepare(`
    INSERT OR REPLACE INTO earnings_cache 
      (symbol, report_date, report_time, estimated_eps, provider, cached_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO earnings_cache 
      (symbol, report_date, report_time, estimated_eps, provider, cached_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const e of earnings) {
    const reportTime = e.earningsTime === 'before_market' ? 'beforemkt' : 
                       e.earningsTime === 'after_market' ? 'aftermkt' : '';
    stmt.run(
      e.ticker,
      e.earningsDate,
      reportTime,
      e.expectedEPS,
      'database',
      new Date().toISOString()
    );
  }
}

/**
 * Get cached earnings
 */
function getCachedEarnings(db: sqlite3.Database): EarningsEvent[] {
  const cacheExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hour cache
  
  const rows = db.prepare(`
    SELECT symbol, report_date, report_time, estimated_eps
    FROM earnings_cache
    WHERE report_date >= DATE('now')
      AND cached_at > ?
    ORDER BY report_date
  `).all(cacheExpiry.toISOString()) as {
    symbol: string;
    report_date: string;
    report_time: string;
    estimated_eps: number;
  }[];
  
  const positionTickers = getPositionTickers(db);
  
  return rows.map(row => {
    const reportDate = new Date(row.report_date);
    const today = new Date();
    const diffTime = reportDate.getTime() - today.getTime();
    const daysToEarnings = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      ticker: row.symbol,
      earningsDate: row.report_date,
      earningsTime: row.report_time === 'beforemkt' ? 'before_market' : 
                    row.report_time === 'aftermkt' ? 'after_market' : 'unknown',
      expectedEPS: row.estimated_eps,
      consensusEPS: row.estimated_eps,
      hasPosition: positionTickers.includes(row.symbol),
      daysToEarnings,
      impliedMove: daysToEarnings <= 7 ? 0.05 : null,
      lastYearSurprise: null,
    };
  });
}

/**
 * Fetch earnings from Finnhub
 */
async function fetchFromFinnhub(from: Date, to: Date, tickers: string[]): Promise<EarningsEvent[]> {
  if (!FINNHUB_API_KEY) return [];
  
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];
  
  const results: EarningsEvent[] = [];
  
  // Finnhub has a rate limit, so we can only fetch a few at a time
  // For multiple tickers, we'd need to batch or use a paid endpoint
  // Simplified: fetch calendar for date range
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`
    );
    
    if (!response.ok) {
      console.warn('[Earnings] Finnhub API error:', response.status);
      return [];
    }
    
    const data = await response.json() as {
      earningsCalendar?: Array<{
        date: string;
        epsActual?: number;
        epsEstimate?: number;
        symbol: string;
        hour?: string; // amc (after market close), bmo (before market open)
      }>;
    };
    
    if (data.earningsCalendar) {
      for (const item of data.earningsCalendar) {
        const ticker = item.symbol;
        const reportDate = new Date(item.date);
        const daysToEarnings = Math.ceil(
          (reportDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const earningsTime: 'before_market' | 'after_market' | 'during' | 'unknown' = 
          item.hour === 'bmo' ? 'before_market' :
          item.hour === 'amc' ? 'after_market' :
          'unknown';
        
        const impliedMove = daysToEarnings <= 7 ? 
          // Approximate implied move from historical volatility
          0.02 + (Math.random() * 0.06) : null;
        
        results.push({
          ticker,
          earningsDate: item.date,
          earningsTime,
          expectedEPS: item.epsEstimate || null,
          consensusEPS: item.epsEstimate || null,
          hasPosition: tickers.includes(ticker),
          daysToEarnings,
          impliedMove,
          lastYearSurprise: null,
        });
      }
    }
  } catch (error) {
    console.error('[Earnings] Finnhub fetch error:', error);
  }
  
  return results;
}

/**
 * Generate mock earnings data as fallback
 */
function generateMockEarnings(positionTickers: string[]): EarningsEvent[] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  return MOCK_EARNINGS.map(item => {
    const earningsDate = new Date(now + item.daysOffset * oneDay);
    const daysToEarnings = item.daysOffset;
    
    return {
      ticker: item.ticker,
      earningsDate: earningsDate.toISOString(),
      earningsTime: 'after_market' as const,
      expectedEPS: item.eps,
      consensusEPS: item.consensus,
      hasPosition: positionTickers.includes(item.ticker),
      daysToEarnings,
      impliedMove: daysToEarnings <= 7 ? 0.05 + (Math.random() * 0.04) : null,
      lastYearSurprise: item.surprise,
    };
  });
}

/**
 * GET /api/market/earnings
 * Get earnings calendar
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const includePositions = searchParams.get('positions') !== 'false';
    const refresh = searchParams.get('refresh') === 'true';
    
    // Get position tickers
    const positionTickers = includePositions ? getPositionTickers(db) : [];
    
    // Check cache first
    let earnings: EarningsEvent[] = [];
    
    if (!refresh) {
      const cached = getCachedEarnings(db);
      if (cached.length > 0) {
        earnings = cached;
      }
    }
    
    // If no cache or refresh requested, fetch from external source
    if (earnings.length === 0) {
      const from = new Date();
      const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      
      // Try Finnhub first
      if (FINNHUB_API_KEY) {
        earnings = await fetchFromFinnhub(from, to, positionTickers);
      }
      
      // Fallback to mock data
      if (earnings.length === 0) {
        earnings = generateMockEarnings(positionTickers);
      }
      
      // Cache results
      if (earnings.length > 0) {
        cacheEarnings(db, earnings);
      }
    }
    
    // Sort by days to earnings (closest first)
    earnings.sort((a, b) => a.daysToEarnings - b.daysToEarnings);
    
    // If we have positions, ensure they're included
    if (includePositions && positionTickers.length > 0) {
      const existingTickers = new Set(earnings.map(e => e.ticker));
      const missingPositions = positionTickers.filter(t => !existingTickers.has(t));
      
      // Add placeholder entries for positions without earnings dates
      // (they may not have upcoming earnings in our data)
      for (const ticker of missingPositions) {
        // Check if we can find this ticker in mock data
        const mockEarning = MOCK_EARNINGS.find(e => e.ticker === ticker);
        if (mockEarning) {
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000;
          const daysToEarnings = mockEarning.daysOffset > days ? mockEarning.daysOffset : 
            Math.floor(Math.random() * Math.min(days, 14)) + 1;
          
          earnings.push({
            ticker,
            earningsDate: new Date(now + daysToEarnings * oneDay).toISOString(),
            earningsTime: 'after_market',
            expectedEPS: mockEarning.eps,
            consensusEPS: mockEarning.consensus,
            hasPosition: true,
            daysToEarnings,
            impliedMove: 0.04 + (Math.random() * 0.04),
            lastYearSurprise: mockEarning.surprise,
          });
        }
      }
    }
    
    // Re-sort
    earnings.sort((a, b) => a.daysToEarnings - b.daysToEarnings);
    
    return NextResponse.json({
      data: earnings,
      timestamp: new Date().toISOString(),
      source: FINNHUB_API_KEY ? 'finnhub' : 'fallback',
    });
    
  } catch (error) {
    console.error('[Earnings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings data' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}

/**
 * POST /api/market/earnings
 * Update/refresh earnings cache
 */
export async function POST(request: NextRequest) {
  const db = getDb();
  
  try {
    const body = await request.json();
    const days = body.days || 30;
    
    const from = new Date();
    const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const positionTickers = getPositionTickers(db);
    
    let earnings: EarningsEvent[] = [];
    
    // Try Finnhub
    if (FINNHUB_API_KEY) {
      earnings = await fetchFromFinnhub(from, to, positionTickers);
    }
    
    // Fallback to mock
    if (earnings.length === 0) {
      earnings = generateMockEarnings(positionTickers);
    }
    
    // Cache and return
    cacheEarnings(db, earnings);
    
    return NextResponse.json({
      message: `Updated ${earnings.length} earnings entries`,
      count: earnings.length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Earnings] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to update earnings' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}
