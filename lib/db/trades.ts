import 'server-only';

/**
 * Database layer for Trade Journal & History
 * Handles trade events, performance analytics, and assignments
 */

import sqlite3 from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = '/Users/server/clawd/trading/market_data.db';

// Initialize database connection
function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// Types for trade events
export type TradeEvent = {
  id: number;
  ticker: string;
  strategy: string;
  eventType: 'open' | 'close' | 'roll' | 'assigned';
  eventDate: string;
  entryPrice: number;
  exitPrice: number | null;
  contracts: number;
  pnl: number | null;
  realizedPnl: number | null;
  notes: string | null;
  rolledFromId: number | null;
  rolledToId: number | null;
  closeReason: string | null;
};

export type StrategyPerformance = {
  strategy: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgRoc: number | null;
  totalPnl: number;
  avgTradePnl: number;
};

export type Assignment = {
  id: number;
  ticker: string;
  assignmentDate: string;
  strikePrice: number;
  contracts: number;
  costBasis: number;
  stockPriceAtAssignment: number | null;
  currentStockPrice: number | null;
  unrealizedPnl: number | null;
  stillHeld: boolean;
  notes: string | null;
};

// Get all trade events with optional filtering
export async function getTradeEvents(filters?: {
  fromDate?: string;
  toDate?: string;
  strategy?: string;
  ticker?: string;
  eventType?: string;
}): Promise<TradeEvent[]> {
  const db = getDb();
  
  let query = `
    SELECT 
      id,
      ticker,
      strategy,
      entry_date as eventDate,
      close_date as closeDate,
      entry_credit_per_contract as entryPrice,
      close_debit_per_contract as exitPrice,
      contracts,
      status,
      realized_pnl as realizedPnl,
      notes,
      rolled_from_position_id as rolledFromId,
      rolled_to_position_id as rolledToId
    FROM positions
    WHERE status IN ('closed', 'rolled', 'assigned', 'expired', 'exercised')
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters?.fromDate) {
    conditions.push('(close_date >= ? OR entry_date >= ?)');
    params.push(filters.fromDate, filters.fromDate);
  }
  
  if (filters?.toDate) {
    conditions.push('(close_date <= ? OR entry_date <= ?)');
    params.push(filters.toDate, filters.toDate);
  }
  
  if (filters?.strategy) {
    conditions.push('strategy = ?');
    params.push(filters.strategy);
  }
  
  if (filters?.ticker) {
    conditions.push('ticker LIKE ?');
    params.push(`%${filters.ticker.toUpperCase()}%`);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY COALESCE(close_date, entry_date) DESC';
  
  const rows = db.prepare(query).all(...params) as any[];
  db.close();
  
  return rows.map(row => {
    const eventType: TradeEvent['eventType'] = 
      row.status === 'assigned' || row.status === 'exercised' ? 'assigned' :
      row.status === 'rolled' ? 'roll' :
      row.status === 'closed' ? 'close' : 'close';
    
    return {
      id: row.id,
      ticker: row.ticker,
      strategy: row.strategy,
      eventType: eventType,
      eventDate: row.closeDate || row.eventDate,
      entryPrice: row.entryPrice,
      exitPrice: row.exitPrice,
      contracts: row.contracts,
      pnl: row.realizedPnl,
      realizedPnl: row.realizedPnl,
      notes: row.notes,
      rolledFromId: row.rolledFromId,
      rolledToId: row.rolledToId,
      closeReason: null, // Future enhancement
    };
  });
}

// Get all positions (including open) for complete trade history
export async function getCompleteTradeHistory(filters?: {
  fromDate?: string;
  toDate?: string;
  strategy?: string;
  ticker?: string;
}): Promise<TradeEvent[]> {
  const db = getDb();
  
  let query = `
    SELECT 
      p.id,
      p.ticker,
      p.strategy,
      p.entry_date,
      p.close_date,
      p.entry_credit_per_contract,
      p.close_debit_per_contract,
      p.contracts,
      p.status,
      p.realized_pnl,
      p.notes,
      p.rolled_from_position_id,
      p.rolled_to_position_id,
      p.roc_percent,
      dp.close as current_stock_price
    FROM positions p
    LEFT JOIN daily_prices dp ON p.ticker = dp.ticker 
      AND dp.date = (SELECT MAX(date) FROM daily_prices WHERE ticker = p.ticker)
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters?.fromDate) {
    conditions.push('(p.entry_date >= ? OR p.close_date >= ?)');
    params.push(filters.fromDate, filters.fromDate);
  }
  
  if (filters?.toDate) {
    conditions.push('(p.entry_date <= ? OR p.close_date <= ?)');
    params.push(filters.toDate, filters.toDate);
  }
  
  if (filters?.strategy) {
    conditions.push('p.strategy = ?');
    params.push(filters.strategy);
  }
  
  if (filters?.ticker) {
    conditions.push('p.ticker LIKE ?');
    params.push(`%${filters.ticker.toUpperCase()}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY p.entry_date DESC';
  
  const rows = db.prepare(query).all(...params) as any[];
  db.close();
  
  return rows.map(row => {
    // Determine event type based on status
    let eventType: TradeEvent['eventType'];
    let eventDate: string;
    let exitPrice: number | null = null;
    let realizedPnl: number | null = null;
    
    if (row.status === 'open') {
      eventType = 'open';
      eventDate = row.entry_date;
    } else if (row.status === 'assigned' || row.status === 'exercised') {
      eventType = 'assigned';
      eventDate = row.close_date || row.entry_date;
      exitPrice = null; // Assigned, not closed
      realizedPnl = row.realized_pnl;
    } else if (row.status === 'rolled') {
      eventType = 'roll';
      eventDate = row.close_date || row.entry_date;
      exitPrice = row.close_debit_per_contract;
      realizedPnl = row.realized_pnl;
    } else {
      eventType = 'close';
      eventDate = row.close_date || row.entry_date;
      exitPrice = row.close_debit_per_contract;
      realizedPnl = row.realized_pnl;
    }
    
    return {
      id: row.id,
      ticker: row.ticker,
      strategy: row.strategy,
      eventType: eventType,
      eventDate: eventDate,
      entryPrice: row.entry_credit_per_contract,
      exitPrice: exitPrice,
      contracts: row.contracts,
      pnl: realizedPnl,
      realizedPnl: realizedPnl,
      notes: row.notes,
      rolledFromId: row.rolled_from_position_id,
      rolledToId: row.rolled_to_position_id,
      closeReason: null,
    };
  });
}

// Get strategy performance analytics
export async function getStrategyPerformance(filters?: {
  fromDate?: string;
  toDate?: string;
}): Promise<StrategyPerformance[]> {
  const db = getDb();
  
  let query = `
    SELECT 
      strategy,
      COUNT(*) as totalTrades,
      SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winningTrades,
      SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END) as losingTrades,
      SUM(CASE WHEN realized_pnl IS NOT NULL THEN realized_pnl ELSE 0 END) as totalPnl,
      AVG(CASE WHEN realized_pnl IS NOT NULL THEN realized_pnl ELSE NULL END) as avgTradePnl,
      AVG(CASE WHEN roc_percent IS NOT NULL THEN roc_percent ELSE NULL END) as avgRoc
    FROM positions
    WHERE status IN ('closed', 'rolled', 'assigned', 'expired', 'exercised')
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters?.fromDate) {
    conditions.push('(close_date >= ? OR entry_date >= ?)');
    params.push(filters.fromDate, filters.fromDate);
  }
  
  if (filters?.toDate) {
    conditions.push('(close_date <= ? OR entry_date <= ?)');
    params.push(filters.toDate, filters.toDate);
  }
  
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' GROUP BY strategy ORDER BY totalTrades DESC';
  
  const rows = db.prepare(query).all(...params) as any[];
  db.close();
  
  return rows.map(row => {
    const totalTrades = row.totalTrades || 0;
    const winningTrades = row.winningTrades || 0;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    return {
      strategy: row.strategy,
      totalTrades: totalTrades,
      winningTrades: winningTrades,
      losingTrades: row.losingTrades || 0,
      winRate: Math.round(winRate * 100) / 100,
      avgRoc: row.avgRoc !== null ? Math.round(row.avgRoc * 100) / 100 : null,
      totalPnl: row.totalPnl || 0,
      avgTradePnl: row.avgTradePnl !== null ? Math.round(row.avgTradePnl * 100) / 100 : 0,
    };
  });
}

// Get assigned CSPs (Cash Secured Puts that were assigned)
export async function getAssignedPositions(filters?: {
  ticker?: string;
}): Promise<Assignment[]> {
  const db = getDb();
  
  let query = `
    SELECT 
      p.id,
      p.ticker,
      p.close_date as assignmentDate,
      p.short_strike as strikePrice,
      p.contracts,
      p.stock_price_at_assignment,
      p.notes,
      dp.close as currentStockPrice
    FROM positions p
    LEFT JOIN daily_prices dp ON p.ticker = dp.ticker 
      AND dp.date = (SELECT MAX(date) FROM daily_prices WHERE ticker = p.ticker)
    WHERE p.status = 'assigned'
      AND p.strategy = 'Cash Secured Put'
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters?.ticker) {
    conditions.push('p.ticker LIKE ?');
    params.push(`%${filters.ticker.toUpperCase()}%`);
  }
  
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY p.close_date DESC';
  
  const rows = db.prepare(query).all(...params) as any[];
  db.close();
  
  return rows.map(row => {
    const shares = row.contracts * 100;
    const costBasis = row.strikePrice * shares; // Simplified - doesn't account for premium received
    
    // Calculate unrealized P&L
    let unrealizedPnl: number | null = null;
    if (row.currentStockPrice !== null) {
      unrealizedPnl = (row.currentStockPrice - row.strikePrice) * shares;
    }
    
    return {
      id: row.id,
      ticker: row.ticker,
      assignmentDate: row.assignmentDate,
      strikePrice: row.strikePrice,
      contracts: row.contracts,
      costBasis: costBasis,
      stockPriceAtAssignment: row.stock_price_at_assignment,
      currentStockPrice: row.currentStockPrice,
      unrealizedPnl: unrealizedPnl !== null ? Math.round(unrealizedPnl * 100) / 100 : null,
      stillHeld: true, // Future: track when sold
      notes: row.notes,
    };
  });
}

// Get unique strategies for filter dropdown
export async function getUniqueStrategies(): Promise<string[]> {
  const db = getDb();
  
  const query = `
    SELECT DISTINCT strategy 
    FROM positions 
    ORDER BY strategy ASC
  `;
  
  const rows = db.prepare(query).all() as any[];
  db.close();
  
  return rows.map(row => row.strategy);
}

// Get unique tickers for filter dropdown
export async function getUniqueTickers(): Promise<string[]> {
  const db = getDb();
  
  const query = `
    SELECT DISTINCT ticker 
    FROM positions 
    ORDER BY ticker ASC
  `;
  
  const rows = db.prepare(query).all() as any[];
  db.close();
  
  return rows.map(row => row.ticker);
}
