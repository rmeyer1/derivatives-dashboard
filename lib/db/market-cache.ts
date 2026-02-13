// Market data cache database layer
// Caches API responses to reduce rate limiting and improve performance

import sqlite3 from 'better-sqlite3';

const DB_PATH = '/Users/server/clawd/trading/market_data.db';

function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

// Initialize cache tables
export function initMarketCacheTables(): void {
  const db = getDb();
  
  // Market data cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_data_cache (
      cache_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      data_type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      data_json TEXT NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Indexes for efficient lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cache_expires ON market_data_cache(expires_at);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cache_symbol_type ON market_data_cache(symbol, data_type);`);
  
  // IV history table for IV rank calculations
  db.exec(`
    CREATE TABLE IF NOT EXISTS iv_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      option_symbol TEXT,
      iv_value REAL NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, option_symbol, DATE(recorded_at))
    );
  `);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_iv_symbol_date ON iv_history(symbol, recorded_at);`);
  
  // Earnings calendar cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS earnings_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      report_date TEXT NOT NULL,
      report_time TEXT,
      estimated_eps REAL,
      actual_eps REAL,
      provider TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, report_date)
    );
  `);
  
  db.close();
}

// Cache operations
export function getCachedData(
  cacheKey: string
): { data: any; fetchedAt: Date } | null {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT data_json, fetched_at 
    FROM market_data_cache 
    WHERE cache_key = ? 
    AND (expires_at IS NULL OR expires_at > datetime('now'))
  `).get(cacheKey) as { data_json: string; fetched_at: string } | undefined;
  
  db.close();
  
  if (!row) return null;
  
  return {
    data: JSON.parse(row.data_json),
    fetchedAt: new Date(row.fetched_at),
  };
}

export function setCachedData(
  cacheKey: string,
  provider: string,
  dataType: string,
  symbol: string,
  data: any,
  ttlSeconds: number = 60
): void {
  const db = getDb();
  
  const dataJson = JSON.stringify(data);
  const expiresAt = ttlSeconds > 0 
    ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
    : null;
  
  db.prepare(`
    INSERT INTO market_data_cache 
    (cache_key, provider, data_type, symbol, data_json, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      data_json = excluded.data_json,
      fetched_at = CURRENT_TIMESTAMP,
      expires_at = excluded.expires_at
  `).run(cacheKey, provider, dataType, symbol, dataJson, expiresAt);
  
  db.close();
}

export function invalidateCache(pattern?: string): void {
  const db = getDb();
  
  if (pattern) {
    db.prepare(`DELETE FROM market_data_cache WHERE cache_key LIKE ?`).run(`%${pattern}%`);
  } else {
    db.exec(`DELETE FROM market_data_cache WHERE expires_at < datetime('now')`);
  }
  
  db.close();
}

// IV history operations
export function recordIV(
  symbol: string,
  ivValue: number,
  optionSymbol?: string
): void {
  const db = getDb();
  
  db.prepare(`
    INSERT OR REPLACE INTO iv_history (symbol, option_symbol, iv_value)
    VALUES (?, ?, ?)
  `).run(symbol, optionSymbol || null, ivValue);
  
  db.close();
}

export function getIVHistory(
  symbol: string,
  days: number = 252
): { ivValue: number; recordedAt: Date }[] {
  const db = getDb();
  
  const rows = db.prepare(`
    SELECT iv_value, recorded_at 
    FROM iv_history 
    WHERE symbol = ? 
    AND recorded_at > datetime('now', ?)
    ORDER BY recorded_at ASC
  `).all(symbol, `-${days} days`);
  
  db.close();
  
  return rows.map((row: any) => ({
    ivValue: row.iv_value,
    recordedAt: new Date(row.recorded_at),
  }));
}

// Earnings cache operations
export function cacheEarnings(
  symbol: string,
  reportDate: string,
  reportTime?: string,
  estimatedEPS?: number,
  provider?: string
): void {
  const db = getDb();
  
  db.prepare(`
    INSERT INTO earnings_cache (symbol, report_date, report_time, estimated_eps, provider)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(symbol, report_date) DO UPDATE SET
      report_time = COALESCE(excluded.report_time, report_time),
      estimated_eps = COALESCE(excluded.estimated_eps, estimated_eps),
      provider = excluded.provider,
      cached_at = CURRENT_TIMESTAMP
  `).run(symbol, reportDate, reportTime || null, estimatedEPS || null, provider || null);
  
  db.close();
}

export function getCachedEarnings(
  startDate?: string,
  endDate?: string,
  symbol?: string
): any[] {
  const db = getDb();
  
  let query = `SELECT * FROM earnings_cache WHERE 1=1`;
  const params: any[] = [];
  
  if (startDate) {
    query += ` AND report_date >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND report_date <= ?`;
    params.push(endDate);
  }
  
  if (symbol) {
    query += ` AND symbol = ?`;
    params.push(symbol.toUpperCase());
  }
  
  query += ` ORDER BY report_date ASC`;
  
  const rows = db.prepare(query).all(...params);
  db.close();
  
  return rows;
}
