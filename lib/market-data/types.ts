/**
 * Market Data Types
 * Shared interfaces for quotes, snapshots, and historical data
 */

/**
 * Quote - Real-time bid/ask/last price data
 */
export interface Quote {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastPrice: number;
  lastSize: number;
  volume: number;
  timestamp: string; // ISO 8601
}

/**
 * StockSnapshot - Complete snapshot of a stock's market data
 */
export interface StockSnapshot {
  symbol: string;
  quote: Quote;
  dailyBar?: Bar;
  prevDailyBar?: Bar;
  minuteBar?: Bar;
}

/**
 * OptionSnapshot - Options contract market data
 */
export interface OptionSnapshot {
  symbol: string;
  underlying: string;
  strike: number;
  expirationDate: string;
  optionType: 'call' | 'put';
  quote: Quote;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  openInterest?: number;
}

/**
 * Bar - OHLCV bar for historical data
 */
export interface Bar {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  tradeCount?: number;
}

/**
 * MarketDataCacheEntry - Database cache record
 */
export interface MarketDataCacheEntry {
  cacheKey: string;
  provider: string;
  dataType: 'quote' | 'snapshot' | 'option_chain' | 'bars';
  symbol: string;
  dataJson: string;
  fetchedAt: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Provider configuration
 */
export interface MarketDataProviderConfig {
  provider: 'alpaca';
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  // Free tier limits
  maxStocks: number;
  maxOptions: number;
  // Cache TTL in seconds
  quoteCacheTtl: number;
  snapshotCacheTtl: number;
  optionCacheTtl: number;
}

/**
 * Quote update handler callback type
 */
export type QuoteHandler = (quote: Quote) => void;

/**
 * Option quote update handler callback type  
 */
export type OptionQuoteHandler = (optionSnapshot: OptionSnapshot) => void;
