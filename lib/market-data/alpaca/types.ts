/**
 * Alpaca Market Data Types
 * Response types from Alpaca API
 */

/**
 * Alpaca Quote Response
 */
export interface AlpacaQuote {
  t: string; // Timestamp (RFC 3339)
  ax: string; // Exchange of ask price
  ap: number; // Ask price
  as: number; // Ask size
  bx: string; // Exchange of bid price
  bp: number; // Bid price
  bs: number; // Bid size
  c: string[]; // Conditions
  z: string; // Tape
}

/**
 * Alpaca Trade/Last Response
 */
export interface AlpacaTrade {
  t: string; // Timestamp
  x: string; // Exchange
  p: number; // Price
  s: number; // Size
  c: string[]; // Conditions
  i: number; // Trade ID
  z: string; // Tape
}

/**
 * Alpaca Bar Response
 */
export interface AlpacaBar {
  t: string; // Timestamp
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  vw: number; // VWAP
  n: number; // Number of trades
}

/**
 * Alpaca Snapshot Response
 */
export interface AlpacaSnapshot {
  latestQuote: AlpacaQuote;
  latestTrade: AlpacaTrade;
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

/**
 * Alpaca Option Quote
 */
export interface AlpacaOptionQuote {
  t: string; // Timestamp
  ax: string; // Ask exchange
  ap: number; // Ask price
  as: number; // Ask size
  bx: string; // Bid exchange
  bp: number; // Bid price
  bs: number; // Bid size
  c: string[];
  z: string;
}

/**
 * Alpaca Option Snapshot
 */
export interface AlpacaOptionSnapshot {
  symbol: string;
  latestQuote: AlpacaOptionQuote;
  impliedVolatility?: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho?: number;
  };
  openInterest?: number;
}

/**
 * Alpaca Error Response
 */
export interface AlpacaError {
  code: number;
  message: string;
}

/**
 * Paginated response wrapper
 */
export interface AlpacaPaginatedResponse<T> {
  next_page_token?: string;
  [key: string]: T[] | string | undefined;
}

/**
 * Alpaca option contract info
 */
export interface AlpacaOptionContract {
  id: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  expiration_date: string;
  underlying_symbol: string;
  underlying_asset_type: string;
  type: 'call' | 'put';
  style: string;
  strike_price: string;
  multiplier: string;
  size: string;
}
