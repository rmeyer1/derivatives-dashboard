/**
 * usePortfolioLivePrices Hook
 * 
 * Provides real-time price streaming and P&L calculations for portfolio positions.
 * Uses the SSE stream from /api/market/stream for price updates.
 * 
 * NOTE ON OPTIONS:
 * - OCC option symbols are extracted from positions but NOT subscribed to the stream
 * - Alpaca's options endpoint requires a paid tier subscription
 * - For now, we focus on stock positions for live pricing
 * - Option support will be added in a future iteration when API access is available
 */

'use client';

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { Position, Strategy } from '@/types/position';
import { useLivePrices, PriceData } from './useLivePrices';

/**
 * Live position data with real-time pricing and P&L
 */
export interface LivePosition {
  id: number;
  symbol: string;           // Underlying ticker (SPY, AAPL, etc.)
  optionSymbol?: string | null;  // OCC format if applicable (e.g., O:AAPL240315C00172500)
  quantity: number;         // Number of contracts
  entryPrice: number;       // Entry credit per contract
  currentPrice?: number;    // Live mid price (bid+ask)/2
  liveBid?: number;         // Live bid price
  liveAsk?: number;         // Live ask price
  unrealizedPnl?: number;   // Calculated unrealized P&L
  pnlPercent?: number;      // P&L as percentage of max profit
  lastUpdated?: string;     // ISO timestamp of last price update
}

/**
 * Hook result type
 */
export interface UsePortfolioLivePricesResult {
  livePositions: LivePosition[];
  isStreaming: boolean;
  isConnected: boolean;
  error: Error | null;
  lastUpdated: string | null;
  stockSymbols: string[];   // List of unique stock symbols being tracked
  /** 
   * List of option symbols that were identified but not subscribed
   * (Alpaca options requires paid tier)
   */
  pendingOptionSymbols: string[];
}

/**
 * Extract unique stock symbols from positions
 * 
 * For each position, we extract:
 * - The underlying ticker (for all strategies)
 * 
 * NOTE: OCC option symbols are extracted separately but not subscribed
 * as they require Alpaca's paid tier options API.
 */
function extractStockSymbols(positions: Position[]): string[] {
  const symbols = new Set<string>();
  
  for (const position of positions) {
    // Always add the underlying ticker
    if (position.ticker) {
      symbols.add(position.ticker.toUpperCase().trim());
    }
  }
  
  return Array.from(symbols);
}

/**
 * Extract OCC option symbols from positions
 * 
 * Returns symbols that could be used for live option pricing
 * if/when the paid tier API becomes available.
 */
function extractOptionSymbols(positions: Position[]): string[] {
  const symbols: string[] = [];
  
  for (const position of positions) {
    // Skip if position already has an optionSymbol field populated
    if (position.optionSymbol) {
      symbols.push(position.optionSymbol);
      continue;
    }
    
    // Determine option type from strategy
    let optionType: 'call' | 'put' | null = null;
    
    if (position.strategy.includes('Call')) {
      optionType = 'call';
    } else if (position.strategy.includes('Put')) {
      optionType = 'put';
    } else if (position.strategy === 'Iron Condor') {
      // For iron condor, short leg is typically a put
      optionType = 'put';
    } else if (position.strategy === 'Custom' && position.optionType) {
      // Only use 'call' or 'put' for Custom strategy
      if (position.optionType === 'call' || position.optionType === 'put') {
        optionType = position.optionType;
      }
    }
    
    // Could construct OCC symbol here, but we'll skip for now
    // as options API requires paid tier
    if (optionType && position.shortStrike) {
      // Just track that we could have an option symbol
      // Format would be: O:TICKERYYMMDDC/PSTRIKE
      // Not adding to returned list since we can't subscribe to them yet
    }
  }
  
  return symbols;
}

/**
 * Calculate live P&L for a position
 * 
 * For CSPs and Covered Calls:
 * - Profit when option price decreases (buying back cheaper)
 * - P&L = (entryCredit - currentMid) * contracts * 100
 * 
 * For spreads:
 * - Similar logic, adjusted for spread width
 */
function calculateLivePnl(
  position: Position,
  priceData: PriceData | undefined
): { 
  currentPrice: number | undefined;
  unrealizedPnl: number | undefined;
  pnlPercent: number | undefined;
  liveBid: number | undefined;
  liveAsk: number | undefined;
} {
  if (!priceData) {
    return {
      currentPrice: position.currentPrice ?? undefined,
      unrealizedPnl: position.unrealizedPNL ?? undefined,
      pnlPercent: undefined,
      liveBid: undefined,
      liveAsk: undefined,
    };
  }
  
  // Use mid price as estimate of current option price
  const liveBid = priceData.bidPrice;
  const liveAsk = priceData.askPrice;
  const currentMid = (liveBid + liveAsk) / 2;
  
  // Calculate unrealized P&L
  // Entry was a credit (positive), current is debit to close (negative)
  const entryCredit = position.entryCreditPerContract;
  const contracts = position.contracts;
  const multiplier = 100; // Options contracts are 100 shares
  
  let unrealizedPnl: number;
  let pnlPercent: number;
  
  switch (position.strategy) {
    case 'Cash Secured Put':
    case 'Covered Call':
      // Short options: profit when price goes down
      // P&L = (entry - current) * quantity
      unrealizedPnl = (entryCredit - currentMid) * contracts * multiplier;
      // Percent relative to max profit (entry credit)
      pnlPercent = entryCredit > 0 
        ? ((entryCredit - currentMid) / entryCredit) * 100 
        : 0;
      break;
      
    case 'Bull Put Spread':
    case 'Put Credit Spread':
    case 'Call Credit Spread':
    case 'Iron Condor':
      // Credit spreads: similar to short options
      unrealizedPnl = (entryCredit - currentMid) * contracts * multiplier;
      pnlPercent = entryCredit > 0 
        ? ((entryCredit - currentMid) / entryCredit) * 100 
        : 0;
      break;
      
    case 'Call Debit Spread':
    case 'Put Debit Spread':
      // Debit spreads: profit when price goes up
      unrealizedPnl = (currentMid - entryCredit) * contracts * multiplier;
      pnlPercent = entryCredit > 0 
        ? ((currentMid - entryCredit) / entryCredit) * 100 
        : 0;
      break;
      
    default:
      // Default: treat as credit strategy
      unrealizedPnl = (entryCredit - currentMid) * contracts * multiplier;
      pnlPercent = entryCredit > 0 
        ? ((entryCredit - currentMid) / entryCredit) * 100 
        : 0;
  }
  
  return {
    currentPrice: currentMid,
    unrealizedPnl,
    pnlPercent,
    liveBid,
    liveAsk,
  };
}

/**
 * Hook for portfolio live price streaming
 * 
 * @param positions - Array of positions to track
 * @param enableStreaming - Whether to enable live streaming (default: true)
 * @returns Live position data with real-time prices and P&L
 * 
 * @example
 * ```tsx
 * const { livePositions, isStreaming, isConnected } = usePortfolioLivePrices(positions);
 * 
 * // Render with live data
 * livePositions.map(pos => (
 *   <div key={pos.id}>
 *     {pos.symbol}: {pos.unrealizedPnl}
 *   </div>
 * ))
 * ```
 */
export function usePortfolioLivePrices(
  positions: Position[],
  enableStreaming: boolean = true
): UsePortfolioLivePricesResult {
  // Ref to persist last known live prices across renders
  const lastLivePrices = useRef<Record<string, { currentPrice: number; bid: number; ask: number; timestamp: string }>>({});
  
  // Extract unique symbols from positions
  const stockSymbols = useMemo(() => {
    return extractStockSymbols(positions);
  }, [positions]);
  
  // Track option symbols for future implementation
  const pendingOptionSymbols = useMemo(() => {
    return extractOptionSymbols(positions);
  }, [positions]);
  
  // Use the base live prices hook for stock symbols
  const {
    prices,
    isConnected,
    isWebSocketActive,
    error,
    lastUpdated,
  } = useLivePrices({
    symbols: stockSymbols,
    enableWebSocket: enableStreaming,
  });
  
  // Memoize prices to prevent stale closures
  const stablePrices = useMemo(() => prices, [prices]);
  
  // Update last known prices when we get fresh data
  useEffect(() => {
    Object.entries(stablePrices).forEach(([symbol, priceData]) => {
      if (priceData && priceData.bidPrice && priceData.askPrice) {
        const mid = (priceData.bidPrice + priceData.askPrice) / 2;
        lastLivePrices.current[symbol] = {
          currentPrice: mid,
          bid: priceData.bidPrice,
          ask: priceData.askPrice,
          timestamp: priceData.timestamp,
        };
      }
    });
  }, [stablePrices]);
  
  // Build live position data with calculated P&L
  const livePositions = useMemo((): LivePosition[] => {
    return positions.map(position => {
      const symbol = position.ticker.toUpperCase();
      // Get price data for this position's underlying
      const priceData = stablePrices[symbol];

      // Fallback to last known live price if available, otherwise use stale DB value
      const lastKnown = lastLivePrices.current[symbol];

      // Calculate P&L with live data, preferring real-time over stale
      const pnlData = calculateLivePnl(position, priceData);

      // If no live priceData but we have lastKnown, use that INSTEAD of stale DB
      let effectivePnlData = pnlData;
      if (!priceData && lastKnown) {
        const fallbackPriceData: PriceData = {
          symbol,
          bidPrice: lastKnown.bid,
          askPrice: lastKnown.ask,
          bidSize: 0,
          askSize: 0,
          lastPrice: lastKnown.currentPrice,
          lastSize: 0,
          volume: 0,
          timestamp: lastKnown.timestamp,
        };
        effectivePnlData = calculateLivePnl(position, fallbackPriceData);
      }

      return {
        id: position.id,
        symbol: position.ticker,
        optionSymbol: position.optionSymbol,
        quantity: position.contracts,
        entryPrice: position.entryCreditPerContract,
        currentPrice: effectivePnlData.currentPrice,
        liveBid: effectivePnlData.liveBid,
        liveAsk: effectivePnlData.liveAsk,
        unrealizedPnl: effectivePnlData.unrealizedPnl,
        pnlPercent: effectivePnlData.pnlPercent,
        lastUpdated: priceData?.timestamp ?? lastKnown?.timestamp ?? lastUpdated ?? undefined,
      };
    });
  }, [positions, stablePrices, lastUpdated]);
  
  // Determine if we're actively streaming
  const isStreaming = isWebSocketActive && enableStreaming;
  
  return {
    livePositions,
    isStreaming,
    isConnected,
    error,
    lastUpdated,
    stockSymbols,
    pendingOptionSymbols,
  };
}

/**
 * Helper to merge live position data with original positions
 * Useful for components that need the full Position object plus live data
 */
export function mergeLiveData(
  positions: Position[],
  livePositions: LivePosition[]
): Array<Position & { liveBid?: number; liveAsk?: number }> {
  const liveMap = new Map(livePositions.map(lp => [lp.id, lp]));
  
  return positions.map(position => {
    const live = liveMap.get(position.id);
    return {
      ...position,
      // Merge in live data, converting undefined to null where needed
      currentPrice: live?.currentPrice ?? position.currentPrice,
      unrealizedPNL: live?.unrealizedPnl ?? position.unrealizedPNL,
      liveBid: live?.liveBid,
      liveAsk: live?.liveAsk,
    };
  });
}

export default usePortfolioLivePrices;
