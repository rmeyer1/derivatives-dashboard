/**
 * Market Data Cache
 * Database-backed caching layer for market data
 */

import sqlite3 from 'better-sqlite3';
import { Quote, StockSnapshot, OptionSnapshot, Bar, MarketDataCacheEntry } from './types';
import { MarketDataProviderConfig } from './types';

const DB_PATH = '/Users/server/clawd/trading/market_data.db';

// Initialize database connection
function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Initialize the market data cache table
 */
export function initializeCacheTable(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_data_cache (
      cache_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      data_type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_market_data_cache_symbol 
    ON market_data_cache(symbol);
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_market_data_cache_expires 
    ON market_data_cache(expires_at);
  `);

  db.close();
}

/**
 * Generate a cache key for a data type and symbol(s)
 */
function generateCacheKey(
  dataType: 'quote' | 'snapshot' | 'option_chain' | 'bars',
  symbol: string,
  params?: Record<string, string>
): string {
  const base = `${dataType}:${symbol.toUpperCase()}`;
  if (!params || Object.keys(params).length === 0) {
    return base;
  }
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${base}:${paramStr}`;
}

/**
 * Get cached quote
 */
export function getCachedQuote(
  symbol: string,
  provider: string
): Quote | null {
  const db = getDb();
  
  const cacheKey = generateCacheKey('quote', symbol);
  const now = new Date().toISOString();
  
  const row = db.prepare(`
    SELECT data_json 
    FROM market_data_cache 
    WHERE cache_key = ? 
    AND provider = ?
    AND data_type = 'quote'
    AND expires_at > ?
  `).get(cacheKey, provider, now) as { data_json: string } | undefined;
  
  db.close();
  
  if (row) {
    return JSON.parse(row.data_json) as Quote;
  }
  
  return null;
}

/**
 * Cache a quote
 */
export function cacheQuote(
  quote: Quote,
  provider: string,
  ttlSeconds: number
): void {
  const db = getDb();
  
  const cacheKey = generateCacheKey('quote', quote.symbol);
  const now = new Date();
  const fetchedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO market_data_cache 
      (cache_key, provider, data_type, symbol, data_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      provider = excluded.provider,
      data_json = excluded.data_json,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run(
    cacheKey,
    provider,
    'quote',
    quote.symbol.toUpperCase(),
    JSON.stringify(quote),
    fetchedAt,
    expiresAt
  );
  
  db.close();
}

/**
 * Get cached snapshot
 */
export function getCachedSnapshot(
  symbol: string,
  provider: string
): StockSnapshot | null {
  const db = getDb();
  
  const cacheKey = generateCacheKey('snapshot', symbol);
  const now = new Date().toISOString();
  
  const row = db.prepare(`
    SELECT data_json 
    FROM market_data_cache 
    WHERE cache_key = ? 
    AND provider = ?
    AND data_type = 'snapshot'
    AND expires_at > ?
  `).get(cacheKey, provider, now) as { data_json: string } | undefined;
  
  db.close();
  
  if (row) {
    return JSON.parse(row.data_json) as StockSnapshot;
  }
  
  return null;
}

/**
 * Cache a snapshot
 */
export function cacheSnapshot(
  snapshot: StockSnapshot,
  provider: string,
  ttlSeconds: number
): void {
  const db = getDb();
  
  const cacheKey = generateCacheKey('snapshot', snapshot.symbol);
  const now = new Date();
  const fetchedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO market_data_cache 
      (cache_key, provider, data_type, symbol, data_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      provider = excluded.provider,
      data_json = excluded.data_json,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run(
    cacheKey,
    provider,
    'snapshot',
    snapshot.symbol.toUpperCase(),
    JSON.stringify(snapshot),
    fetchedAt,
    expiresAt
  );
  
  db.close();
}

/**
 * Get cached option chain
 */
export function getCachedOptionChain(
  underlying: string,
  provider: string,
  expirationDate?: string
): OptionSnapshot[] | null {
  const db = getDb();
  
  const cacheKey = generateCacheKey(
    'option_chain',
    underlying,
    expirationDate ? { exp: expirationDate } : undefined
  );
  const now = new Date().toISOString();
  
  const row = db.prepare(`
    SELECT data_json 
    FROM market_data_cache 
    WHERE cache_key = ? 
    AND provider = ?
    AND data_type = 'option_chain'
    AND expires_at > ?
  `).get(cacheKey, provider, now) as { data_json: string } | undefined;
  
  db.close();
  
  if (row) {
    return JSON.parse(row.data_json) as OptionSnapshot[];
  }
  
  return null;
}

/**
 * Cache an option chain
 */
export function cacheOptionChain(
  underlying: string,
  options: OptionSnapshot[],
  provider: string,
  ttlSeconds: number,
  expirationDate?: string
): void {
  const db = getDb();
  
  const cacheKey = generateCacheKey(
    'option_chain',
    underlying,
    expirationDate ? { exp: expirationDate } : undefined
  );
  const now = new Date();
  const fetchedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO market_data_cache 
      (cache_key, provider, data_type, symbol, data_json, fetched_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      provider = excluded.provider,
      data_json = excluded.data_json,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run(
    cacheKey,
    provider,
    'option_chain',
    underlying.toUpperCase(),
    JSON.stringify(options),
    fetchedAt,
    expiresAt
  );
  
  db.close();
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(): number {
  const db = getDb();
  
  const now = new Date().toISOString();
  const result = db.prepare(`
    DELETE FROM market_data_cache 
    WHERE expires_at <= ?
  `).run(now);
  
  db.close();
  
  return result.changes;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  expiredEntries: number;
  byDataType: Record<string, number>;
} {
  const db = getDb();
  
  const total = db.prepare('SELECT COUNT(*) as count FROM market_data_cache').get() as { count: number };
  
  const now = new Date().toISOString();
  const expired = db.prepare('SELECT COUNT(*) as count FROM market_data_cache WHERE expires_at <= ?').get(now) as { count: number };
  
  const byType = db.prepare(`
    SELECT data_type, COUNT(*) as count 
    FROM market_data_cache 
    GROUP BY data_type
  `).all() as { data_type: string; count: number }[];
  
  db.close();
  
  const byDataType: Record<string, number> = {};
  for (const row of byType) {
    byDataType[row.data_type] = row.count;
  }
  
  return {
    totalEntries: total.count,
    expiredEntries: expired.count,
    byDataType,
  };
}

/**
 * Clear all market data cache
 */
export function clearCache(): void {
  const db = getDb();
  db.prepare('DELETE FROM market_data_cache').run();
  db.close();
}
