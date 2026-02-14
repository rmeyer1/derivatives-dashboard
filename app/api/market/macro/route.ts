import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig } from '@/lib/market-data';
import sqlite3 from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data/market_data.db';

// Sector ETFs to track
const SECTOR_ETFS = [
  { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'Broad Market' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', sector: 'Technology' },
  { symbol: 'IWM', name: 'Russell 2000 ETF', sector: 'Small Cap' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR', sector: 'Technology' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR', sector: 'Financials' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR', sector: 'Energy' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR', sector: 'Health Care' },
  { symbol: 'XLI', name: 'Industrials Select Sector SPDR', sector: 'Industrials' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR', sector: 'Consumer Staples' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR', sector: 'Consumer Discretionary' },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR', sector: 'Utilities' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR', sector: 'Real Estate' },
  { symbol: 'XLB', name: 'Materials Select Sector SPDR', sector: 'Materials' },
  { symbol: 'VIX', name: 'CBOE Volatility Index', sector: 'Volatility' },
];

interface SparkPoint {
  time: string;
  value: number;
}

interface MacroDataItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: SparkPoint[];
}

function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

/**
 * Generate 20-point sparkline data
 */
function generateSparkline(basePrice: number, volatility: number, points: number = 20): SparkPoint[] {
  const sparkline: SparkPoint[] = [];
  let currentPrice = basePrice;
  const now = Date.now();
  
  for (let i = points; i >= 0; i--) {
    const time = new Date(now - i * 60 * 60 * 1000); // Hourly data
    const change = (Math.random() - 0.5) * volatility * basePrice * 0.1;
    currentPrice += change;
    sparkline.push({
      time: time.toISOString(),
      value: Math.round(currentPrice * 100) / 100
    });
  }
  
  return sparkline;
}

/**
 * Generate mock data for a symbol
 */
function generateMockData(symbol: string, name: string, sector: string): MacroDataItem {
  // Base prices for known symbols
  const basePrices: Record<string, number> = {
    'SPY': 595.32,
    'QQQ': 518.67,
    'IWM': 225.45,
    'VIX': 16.28,
    'XLK': 235.18,
    'XLF': 48.92,
    'XLE': 85.34,
    'XLV': 145.67,
    'XLI': 112.45,
    'XLP': 78.23,
    'XLY': 195.32,
    'XLU': 65.89,
    'XLRE': 38.45,
    'XLB': 82.67,
  };
  
  const basePrice = basePrices[symbol] || 100;
  const isVix = symbol === 'VIX';
  
  // Different volatility for VIX vs stocks
  const volatility = isVix ? 0.08 : 0.02;
  const variation = (Math.random() - 0.5) * volatility * 2;
  
  // VIX moves are more dramatic and often inverse to market
  const change = isVix 
    ? variation * basePrice * 2  // Higher volatility for VIX
    : variation * basePrice;
  
  const changePercent = (change / basePrice) * 100;
  const currentPrice = basePrice + (change * 0.5); // Current is halfway in the day's move
  
  return {
    symbol,
    name,
    price: Math.round(currentPrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    sparkline: generateSparkline(basePrice, volatility),
  };
}

/**
 * Get cached data from database
 */
function getCachedMacroData(db: sqlite3.Database, symbol: string): MacroDataItem | null {
  const cacheExpiry = new Date(Date.now() - 5 * 60 * 1000); // 5 minute cache
  
  const row = db.prepare(`
    SELECT data_json, fetched_at
    FROM market_data_cache
    WHERE symbol = ? 
      AND data_type = 'macro'
      AND fetched_at > ?
    ORDER BY fetched_at DESC
    LIMIT 1
  `).get(symbol, cacheExpiry.toISOString()) as { data_json: string; fetched_at: string } | undefined;
  
  if (row) {
    try {
      return JSON.parse(row.data_json) as MacroDataItem;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Cache macro data
 */
function cacheMacroData(db: sqlite3.Database, symbol: string, data: MacroDataItem): void {
  const now = new Date();
  db.prepare(`
    INSERT INTO market_data_cache (cache_key, provider, data_type, symbol, data_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      data_json = excluded.data_json,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run(
    `macro:${symbol}`,
    'market-data',
    'macro',
    symbol,
    JSON.stringify(data),
    now.toISOString(),
    new Date(now.getTime() + 5 * 60 * 1000).toISOString() // 5 min TTL
  );
}

/**
 * Fetch from Alpaca API
 */
async function fetchFromAlpaca(symbol: string): Promise<MacroDataItem | null> {
  if (!isValidConfig()) return null;
  
  try {
    // VIX is a special symbol - it's actually available as a ticker
    const ticker = symbol === 'VIX' ? 'VIX' : symbol;
    
    const snapshot = await marketData.getSnapshot(ticker);
    const quote = snapshot.quote;
    
    // Get previous close for change calculation
    const prevClose = snapshot.prevDailyBar?.close || 
                      snapshot.minuteBar?.open || 
                      (quote.bidPrice + quote.askPrice) / 2;
    const currentPrice = quote.lastPrice || (quote.bidPrice + quote.askPrice) / 2;
    
    const change = currentPrice - prevClose;
    const changePercent = (change / prevClose) * 100;
    
    // Get historical for sparkline (last 20 hours)
    try {
      const bars = await marketData.getHistoricalBars(ticker, '1Hour', 20);
      
      const sparkline: SparkPoint[] = bars.map(bar => ({
        time: bar.timestamp,
        value: bar.close
      }));
      
      // If we don't have 20 bars, fill with current estimate
      if (sparkline.length < 20) {
        while (sparkline.length < 20) {
          const lastValue = sparkline[sparkline.length - 1]?.value || currentPrice;
          sparkline.push({
            time: new Date().toISOString(),
            value: lastValue
          });
        }
      }
      
      const etfInfo = SECTOR_ETFS.find(e => e.symbol === symbol);
      
      return {
        symbol,
        name: etfInfo?.name || symbol,
        price: Math.round(currentPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        sparkline: sparkline.slice(-20),
      };
    } catch {
      // Fallback to generated sparkline
    }
    
    const etfInfo = SECTOR_ETFS.find(e => e.symbol === symbol);
    return {
      symbol,
      name: etfInfo?.name || symbol,
      price: Math.round(currentPrice * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      sparkline: generateSparkline(currentPrice, symbol === 'VIX' ? 0.08 : 0.02),
    };
  } catch (error) {
    console.warn(`[Macro] Failed to fetch ${symbol} from Alpaca:`, error);
    return null;
  }
}

/**
 * GET /api/market/macro
 * Get macro data (VIX + sector ETFs)
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const refresh = searchParams.get('refresh') === 'true';
    
    // Determine which symbols to fetch
    let symbols: string[];
    if (symbolsParam) {
      symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    } else {
      // Default: VIX + broad market + top sectors
      symbols = ['VIX', 'SPY', 'QQQ', 'XLK', 'XLF', 'XLE'];
    }
    
    const results: MacroDataItem[] = [];
    
    for (const symbol of symbols) {
      let data: MacroDataItem | null = null;
      
      // Check cache first
      if (!refresh) {
        data = getCachedMacroData(db, symbol);
      }
      
      // Try fetching from API if not cached
      if (!data && isValidConfig()) {
        data = await fetchFromAlpaca(symbol);
        if (data) {
          cacheMacroData(db, symbol, data);
        }
      }
      
      // Fallback to mock data
      if (!data) {
        const etfInfo = SECTOR_ETFS.find(e => e.symbol === symbol);
        if (etfInfo) {
          data = generateMockData(symbol, etfInfo.name, etfInfo.sector);
          cacheMacroData(db, symbol, data);
        }
      }
      
      if (data) {
        results.push(data);
      }
    }
    
    // Sort: VIX first, then others by sector
    results.sort((a, b) => {
      if (a.symbol === 'VIX') return -1;
      if (b.symbol === 'VIX') return 1;
      return a.symbol.localeCompare(b.symbol);
    });
    
    return NextResponse.json({
      data: results,
      timestamp: new Date().toISOString(),
      source: isValidConfig() ? 'alpaca' : 'fallback',
    });
    
  } catch (error) {
    console.error('[Macro] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch macro data' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}

/**
 * POST /api/market/macro
 * Refresh macro data
 */
export async function POST(request: NextRequest) {
  const db = getDb();
  
  try {
    const body = await request.json();
    const symbols = body.symbols as string[] || ['VIX', 'SPY', 'QQQ', 'XLK', 'XLF', 'XLE'];
    
    const updated: MacroDataItem[] = [];
    
    for (const symbol of symbols) {
      let data = await fetchFromAlpaca(symbol);
      
      if (!data) {
        const etfInfo = SECTOR_ETFS.find(e => e.symbol === symbol);
        if (etfInfo) {
          data = generateMockData(symbol, etfInfo.name, etfInfo.sector);
        }
      }
      
      if (data) {
        cacheMacroData(db, symbol, data);
        updated.push(data);
      }
    }
    
    return NextResponse.json({
      message: `Updated ${updated.length} macro data entries`,
      data: updated,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Macro] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to update macro data' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}
