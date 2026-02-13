/**
 * SQLite Database Layer for Positions
 * Uses the trading/market_data.db database
 */

import sqlite3 from 'better-sqlite3';
import { join } from 'path';
import { Position, CreatePositionRequest, UpdatePositionRequest, toOCCSymbol } from '@/types/position';

const DB_PATH = '/Users/server/clawd/trading/market_data.db';

// Initialize database connection
function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// Calculate derived fields
function calculateCollateral(
  strategy: string,
  shortStrike: number,
  longStrike: number | null,
  contracts: number
): number {
  if (strategy === 'Cash Secured Put') {
    return shortStrike * contracts * 100;
  } else if (strategy === 'Covered Call') {
    return 0;
  } else if (strategy.includes('Spread') || strategy === 'Iron Condor') {
    if (longStrike) {
      return Math.abs(shortStrike - longStrike) * contracts * 100;
    }
    return shortStrike * contracts * 100;
  }
  return shortStrike * contracts * 100;
}

function calculateDTE(expirationDate: string): number {
  const exp = new Date(expirationDate);
  const today = new Date();
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function isITM(
  strategy: string,
  shortStrike: number,
  longStrike: number | null,
  stockPrice: number | null
): boolean {
  if (!stockPrice) return false;
  
  if (strategy === 'Cash Secured Put' || strategy === 'Bull Put Spread') {
    return stockPrice < shortStrike;
  } else if (strategy === 'Covered Call' || strategy === 'Call Credit Spread') {
    return stockPrice > shortStrike;
  }
  return false;
}

function calculateUnrealizedPNL(
  entryCredit: number,
  currentPrice: number | null,
  contracts: number
): number | null {
  if (currentPrice === null) return null;
  return (entryCredit - currentPrice) * contracts * 100;
}

// Transform database row to Position object
function transformPosition(row: any, stockPrice: number | null = null): Position {
  const entryCredit = row.entry_credit_per_contract || 0;
  const currentPrice = row.current_price;
  const contracts = row.contracts || 0;
  
  const itm = isITM(
    row.strategy,
    row.short_strike,
    row.long_strike,
    stockPrice
  );
  
  const unrealizedPNL = calculateUnrealizedPNL(entryCredit, currentPrice, contracts);
  const dte = calculateDTE(row.expiration_date);
  
  const entryCreditTotal = entryCredit * contracts * 100;
  
  return {
    id: row.id,
    ticker: row.ticker,
    strategy: row.strategy,
    optionType: row.option_type,
    contracts: row.contracts,
    shortStrike: row.short_strike,
    longStrike: row.long_strike,
    entryCreditPerContract: entryCredit,
    entryCreditTotal: entryCreditTotal,
    collateralRequired: row.collateral_required,
    expirationDate: row.expiration_date,
    entryDate: row.entry_date,
    status: row.status,
    notes: row.notes,
    currentPrice: row.current_price,
    unrealizedPNL: unrealizedPNL,
    realizedPNL: row.realized_pnl,
    itm: itm,
    dte: dte,
    acknowledgmentFlag: Boolean(row.acknowledgment_flag),
    alertType: row.alert_type,
    managementPlan: row.management_plan,
    rolledFromPositionId: row.rolled_from_position_id,
    closeDate: row.close_date,
    stockPrice: stockPrice,
    entryPriceUnderlying: row.entry_price_underlying,
    optionSymbol: row.option_symbol || null,
  };
}

// Get positions with optional filtering
export async function getPositions(filters?: {
  status?: string;
  strategy?: string;
  ticker?: string;
}): Promise<Position[]> {
  const db = getDb();
  
  let query = `
    SELECT 
      p.*,
      dp.close as stock_price
    FROM positions p
    LEFT JOIN daily_prices dp ON p.ticker = dp.ticker 
      AND dp.date = (SELECT MAX(date) FROM daily_prices WHERE ticker = p.ticker)
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters?.status) {
    conditions.push('p.status = ?');
    params.push(filters.status);
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
  
  query += ' ORDER BY p.expiration_date ASC, p.ticker';
  
  const rows = db.prepare(query).all(...params) as Array<any>;
  db.close();
  
  return rows.map(row => transformPosition(row, row.stock_price));
}

// Get single position by ID
export async function getPositionById(id: number): Promise<Position | null> {
  const db = getDb();
  
  const row = db.prepare(`
    SELECT 
      p.*,
      dp.close as stock_price
    FROM positions p
    LEFT JOIN daily_prices dp ON p.ticker = dp.ticker 
      AND dp.date = (SELECT MAX(date) FROM daily_prices WHERE ticker = p.ticker)
    WHERE p.id = ?
  `).get(id) as any;
  
  db.close();
  
  if (!row) return null;
  return transformPosition(row, row.stock_price);
}

// Create new position
export async function createPosition(data: CreatePositionRequest): Promise<Position> {
  const db = getDb();
  
  // Calculate collateral
  const collateral = calculateCollateral(
    data.strategy,
    data.shortStrike,
    data.longStrike || null,
    data.contracts
  );
  
  // Determine option type
  let optionType: 'call' | 'put' | 'spread' = 'spread';
  if (data.strategy.includes('Call')) {
    optionType = 'call';
  } else if (data.strategy.includes('Put')) {
    optionType = 'put';
  }
  
  // Generate OCC symbol for options (for market data subscription)
  let optionSymbol: string | null = null;
  if (optionType !== 'spread') {
    optionSymbol = toOCCSymbol(
      data.ticker,
      data.expirationDate,
      optionType,
      data.shortStrike,
      true // include O: prefix
    );
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  const result = db.prepare(`
    INSERT INTO positions (
      ticker, strategy, option_type, entry_date, expiration_date,
      contracts, short_strike, long_strike, entry_credit_per_contract,
      collateral_required, notes, entry_price_underlying, status, option_symbol
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(
    data.ticker.toUpperCase(),
    data.strategy,
    optionType,
    today,
    data.expirationDate,
    data.contracts,
    data.shortStrike,
    data.longStrike || null,
    data.entryCreditPerContract,
    collateral,
    data.notes || null,
    data.entryPriceUnderlying || null,
    optionSymbol
  );
  
  db.close();
  
  return getPositionById(result.lastInsertRowid as number) as Promise<Position>;
}

// Update position
export async function updatePosition(
  id: number,
  data: UpdatePositionRequest
): Promise<Position | null> {
  const db = getDb();
  
  // Check if position exists
  const existing = db.prepare('SELECT id FROM positions WHERE id = ?').get(id);
  if (!existing) {
    db.close();
    return null;
  }
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (data.currentPrice !== undefined) {
    updates.push('current_price = ?');
    params.push(data.currentPrice);
  }
  
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes);
  }
  
  if (data.acknowledgmentFlag !== undefined) {
    updates.push('acknowledgment_flag = ?');
    params.push(data.acknowledgmentFlag ? 1 : 0);
  }
  
  if (data.alertType !== undefined) {
    updates.push('alert_type = ?');
    params.push(data.alertType);
  }
  
  if (data.managementPlan !== undefined) {
    updates.push('management_plan = ?');
    params.push(data.managementPlan);
  }
  
  if (updates.length === 0) {
    db.close();
    return getPositionById(id);
  }
  
  params.push(id);
  
  db.prepare(`UPDATE positions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  db.close();
  
  return getPositionById(id);
}

// Close position
export async function closePosition(
  id: number,
  closeDebitPerContract: number,
  closeDate?: string
): Promise<Position | null> {
  const db = getDb();
  
  // Get the position
  const position = db.prepare('SELECT * FROM positions WHERE id = ? AND status = ?').get(id, 'open') as any;
  if (!position) {
    db.close();
    return null;
  }
  
  const contracts = position.contracts;
  const closeTotal = closeDebitPerContract * contracts * 100;
  const closeDateStr = closeDate || new Date().toISOString().split('T')[0];
  
  db.prepare(`
    UPDATE positions 
    SET status = 'closed',
        close_date = ?,
        close_debit_per_contract = ?,
        close_price_total = ?
    WHERE id = ?
  `).run(closeDateStr, closeDebitPerContract, closeTotal, id);
  
  db.close();
  
  return getPositionById(id);
}

// Roll position
export async function rollPosition(
  id: number,
  data: {
    newShortStrike: number;
    newLongStrike?: number;
    newExpirationDate: string;
    newEntryCredit: number;
    newContracts?: number;
  }
): Promise<Position | null> {
  const db = getDb();
  
  // Get original position
  const original = db.prepare('SELECT * FROM positions WHERE id = ? AND status = ?').get(id, 'open') as any;
  if (!original) {
    db.close();
    return null;
  }
  
  const newContracts = data.newContracts || original.contracts;
  
  // Calculate new collateral
  const newCollateral = calculateCollateral(
    original.strategy,
    data.newShortStrike,
    data.newLongStrike || null,
    newContracts
  );
  
  // Generate new OCC symbol for the rolled position
  let newOptionSymbol: string | null = null;
  if (original.option_type === 'call' || original.option_type === 'put') {
    newOptionSymbol = toOCCSymbol(
      original.ticker,
      data.newExpirationDate,
      original.option_type,
      data.newShortStrike,
      true
    );
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  // Create new position
  const result = db.prepare(`
    INSERT INTO positions (
      ticker, strategy, option_type, entry_date, expiration_date,
      contracts, short_strike, long_strike, entry_credit_per_contract,
      collateral_required, status, rolled_from_position_id, notes, option_symbol
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).run(
    original.ticker,
    original.strategy,
    original.option_type,
    today,
    data.newExpirationDate,
    newContracts,
    data.newShortStrike,
    data.newLongStrike || null,
    data.newEntryCredit,
    newCollateral,
    id,
    `Rolled from position #${id}`,
    newOptionSymbol
  );
  
  const newId = result.lastInsertRowid;
  
  // Update original position
  db.prepare('UPDATE positions SET status = ?, rolled_to_position_id = ? WHERE id = ?')
    .run('rolled', newId, id);
  
  db.close();
  
  return getPositionById(newId as number);
}

// Delete position
export async function deletePosition(id: number): Promise<boolean> {
  const db = getDb();
  
  const result = db.prepare('DELETE FROM positions WHERE id = ?').run(id);
  db.close();
  
  return result.changes > 0;
}

// Get portfolio summary
export async function getPortfolioSummary(): Promise<{
  totalBPAtRisk: number;
  totalPremiumCollected: number;
  unrealizedPNL: number;
  positionsCount: number;
  itmAlertsCount: number;
}> {
  const db = getDb();
  
  // Get basic stats
  const stats = db.prepare(`
    SELECT 
      COALESCE(SUM(collateral_required), 0) as total_bp,
      COALESCE(SUM(entry_credit_per_contract * contracts * 100), 0) as total_premium,
      COUNT(*) as count
    FROM positions WHERE status = 'open'
  `).get() as any;
  
  // Get positions for ITM calculation
  const positions = db.prepare(`
    SELECT 
      p.*,
      dp.close as stock_price
    FROM positions p
    LEFT JOIN daily_prices dp ON p.ticker = dp.ticker 
      AND dp.date = (SELECT MAX(date) FROM daily_prices WHERE ticker = p.ticker)
    WHERE p.status = 'open'
  `).all() as Array<any>;
  
  db.close();
  
  let itmCount = 0;
  let unrealized = 0;
  
  for (const pos of positions) {
    if (isITM(pos.strategy, pos.short_strike, pos.long_strike, pos.stock_price)) {
      itmCount++;
    }
    if (pos.current_price !== null) {
      unrealized += (pos.entry_credit_per_contract - pos.current_price) * pos.contracts * 100;
    }
  }
  
  return {
    totalBPAtRisk: stats.total_bp || 0,
    totalPremiumCollected: stats.total_premium || 0,
    unrealizedPNL: unrealized,
    positionsCount: stats.count || 0,
    itmAlertsCount: itmCount,
  };
}

// Get ITM alerts
export async function getITMAlerts(): Promise<any[]> {
  const db = getDb();
  
  const positions = db.prepare(`
    SELECT 
      p.*,
      dp.close as stock_price
    FROM positions p
    LEFT JOIN daily_prices dp ON p.ticker = dp.ticker 
      AND dp.date = (SELECT MAX(date) FROM daily_prices WHERE ticker = p.ticker)
    WHERE p.status = 'open' AND p.acknowledgment_flag = 0
  `).all() as Array<any>;
  
  db.close();
  
  const alerts = [];
  
  for (const pos of positions) {
    if (isITM(pos.strategy, pos.short_strike, pos.long_strike, pos.stock_price)) {
      const itmPercent = pos.stock_price && pos.short_strike
        ? Math.abs((pos.stock_price - pos.short_strike) / pos.short_strike * 100)
        : 0;
      
      alerts.push({
        positionId: pos.id,
        ticker: pos.ticker,
        strategy: pos.strategy,
        shortStrike: pos.short_strike,
        stockPrice: pos.stock_price,
        itmPercent: Math.round(itmPercent * 100) / 100,
        dte: calculateDTE(pos.expiration_date),
        managementPlan: pos.management_plan,
      });
    }
  }
  
  // Sort by ITM percent (deepest first)
  alerts.sort((a, b) => b.itmPercent - a.itmPercent);
  
  return alerts;
}
