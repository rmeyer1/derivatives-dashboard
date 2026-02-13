/**
 * Position types for Derivatives Trading Dashboard
 */

export type Strategy = 
  | 'Cash Secured Put' 
  | 'Covered Call' 
  | 'Bull Put Spread' 
  | 'Call Credit Spread'
  | 'Put Credit Spread'
  | 'Call Debit Spread'
  | 'Put Debit Spread'
  | 'Iron Condor'
  | 'Custom';

export type Status = 'open' | 'closed' | 'rolled' | 'assigned' | 'expired' | 'exercised';
export type AlertType = 'ITM' | 'OTM' | 'Near Strike' | 'Earnings' | 'Ex-Div' | 'None' | null;
export type OptionType = 'call' | 'put' | 'spread' | null;

export interface Position {
  id: number;
  ticker: string;
  strategy: Strategy;
  optionType: OptionType;
  contracts: number;
  shortStrike: number;
  longStrike: number | null;
  entryCreditPerContract: number;
  entryCreditTotal: number;
  collateralRequired: number | null;
  expirationDate: string;
  entryDate: string;
  status: Status;
  notes: string | null;
  currentPrice: number | null;
  unrealizedPNL: number | null;
  realizedPNL: number | null;
  itm: boolean;
  dte: number;
  acknowledgmentFlag: boolean;
  alertType: AlertType;
  managementPlan: string | null;
  rolledFromPositionId: number | null;
  closeDate: string | null;
  stockPrice?: number | null;
  entryPriceUnderlying?: number | null;
  // OCC option symbol for live market data subscription
  optionSymbol?: string | null;
}

export interface CreatePositionRequest {
  ticker: string;
  strategy: Strategy;
  contracts: number;
  shortStrike: number;
  longStrike?: number;
  entryCreditPerContract: number;
  expirationDate: string; // YYYY-MM-DD
  notes?: string;
  entryPriceUnderlying?: number;
}

export interface UpdatePositionRequest {
  currentPrice?: number;
  notes?: string;
  acknowledgmentFlag?: boolean;
  alertType?: string;
  managementPlan?: string;
}

export interface ClosePositionRequest {
  closeDebitPerContract: number;
  closeDate?: string; // YYYY-MM-DD, defaults to today
}

export interface RollPositionRequest {
  newShortStrike: number;
  newLongStrike?: number;
  newExpirationDate: string; // YYYY-MM-DD
  newEntryCredit: number;
  newContracts?: number;
}

export interface PortfolioSummary {
  totalBPAtRisk: number;
  totalPremiumCollected: number;
  unrealizedPNL: number;
  positionsCount: number;
  itmAlertsCount: number;
}

export interface RiskDistribution {
  strategy: string;
  collateral: number;
  percentage: number;
}

export interface DTEPosition {
  id: number;
  ticker: string;
  strategy: string;
  expirationDate: string;
  dte: number;
  urgency: 'critical' | 'warning' | 'normal';
}

export interface ITMAlert {
  positionId: number;
  ticker: string;
  strategy: string;
  shortStrike: number;
  stockPrice: number;
  itmPercent: number;
  dte: number;
  managementPlan: string | null;
}

/**
 * Convert position to OCC option symbol format
 * Format: O:SPY251215C00580000 (with O: prefix) or SPY251215C00580000 (without)
 * 
 * @param ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param expirationDate - Expiration date in YYYY-MM-DD format
 * @param optionType - 'call' or 'put'
 * @param strike - Strike price (e.g., 172.5)
 * @param includePrefix - Whether to include 'O:' prefix (default: true)
 * @returns OCC formatted symbol
 * 
 * Example:
 * toOCCSymbol('AAPL', '2024-03-15', 'call', 172.5) => 'O:AAPL240315C00172500'
 */
export function toOCCSymbol(
  ticker: string,
  expirationDate: string,
  optionType: 'call' | 'put',
  strike: number,
  includePrefix: boolean = true
): string {
  const cleanTicker = ticker.toUpperCase().trim();
  
  // Parse expiration date
  const date = new Date(expirationDate);
  const year = date.getFullYear().toString().slice(-2); // Last 2 digits
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Format strike - multiply by 1000, pad to 8 digits
  const strikeCents = Math.round(strike * 1000);
  const strikeStr = strikeCents.toString().padStart(8, '0');
  
  // Option type code
  const typeCode = optionType === 'call' ? 'C' : 'P';
  
  const symbol = `${cleanTicker}${year}${month}${day}${typeCode}${strikeStr}`;
  return includePrefix ? `O:${symbol}` : symbol;
}

/**
 * Parse OCC option symbol to components
 * 
 * @param occSymbol - OCC formatted symbol (with or without O: prefix)
 * @returns Object with ticker, expirationDate, optionType, and strike, or null if invalid
 * 
 * Example:
 * parseOCCSymbol('O:AAPL240315C00172500') => 
 *   { ticker: 'AAPL', expirationDate: '2024-03-15', optionType: 'call', strike: 172.5 }
 */
export function parseOCCSymbol(occSymbol: string): {
  ticker: string;
  expirationDate: string;
  optionType: 'call' | 'put';
  strike: number;
} | null {
  const clean = occSymbol.toUpperCase().trim().replace(/^O:/, '');
  
  // OCC format: Underlying(1-6 chars) + YY(2) + MM(2) + DD(2) + C/P(1) + Strike(8)
  const match = clean.match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return null;
  
  const [, ticker, year, month, day, typeCode, strikeStr] = match;
  
  // Convert 2-digit year to 4-digit (assuming 50+ is 19xx, otherwise 20xx)
  const fullYear = parseInt(year, 10) >= 50 ? `19${year}` : `20${year}`;
  const expirationDate = `${fullYear}-${month}-${day}`;
  
  const strike = parseInt(strikeStr, 10) / 1000;
  const optionType = typeCode === 'C' ? 'call' : 'put';
  
  return { ticker, expirationDate, optionType, strike };
}

/**
 * Generate OCC symbol from a position object
 * This determines the appropriate strike and option type based on strategy
 * 
 * @param position - Position object
 * @param useShortStrike - Use short strike (default) or long strike for spreads
 * @returns OCC formatted symbol or null if cannot be determined
 */
export function positionToOCCSymbol(
  position: Position,
  useShortStrike: boolean = true
): string | null {
  // Determine option type from strategy
  let optionType: 'call' | 'put';
  
  if (position.strategy.includes('Call')) {
    optionType = 'call';
  } else if (position.strategy.includes('Put')) {
    optionType = 'put';
  } else if (position.strategy === 'Iron Condor') {
    // For iron condor, use short strike (could be call or put side)
    optionType = useShortStrike ? 'put' : 'call';
  } else if (position.strategy === 'Custom') {
    // For custom, try to infer from optionType field
    if (position.optionType === 'call' || position.optionType === 'put') {
      optionType = position.optionType;
    } else {
      return null;
    }
  } else {
    return null;
  }
  
  const strike = useShortStrike ? position.shortStrike : (position.longStrike || position.shortStrike);
  
  return toOCCSymbol(position.ticker, position.expirationDate, optionType, strike);
}

/**
 * Validate OCC symbol format
 * @param symbol - Symbol to validate
 * @returns true if valid OCC format
 */
export function isValidOCCSymbol(symbol: string): boolean {
  return parseOCCSymbol(symbol) !== null;
}
