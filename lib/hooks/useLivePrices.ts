'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';

// Price data structure
export interface PriceData {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastPrice: number;
  lastSize: number;
  volume: number;
  timestamp: string;
}

// Hook options
interface UseLivePricesOptions {
  symbols: string[];
  enableWebSocket?: boolean;
  pollIntervalMs?: number;
  onPriceUpdate?: (symbol: string, price: PriceData) => void;
  onError?: (error: Error) => void;
}

// Hook result
interface UseLivePricesResult {
  prices: Record<string, PriceData>;
  isConnected: boolean;
  isWebSocketActive: boolean;
  error: Error | null;
  lastUpdated: string | null;
  refetch: () => void;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

// WebSocket connection singleton
let wsConnection: WebSocket | null = null;
let wsSubscribers = new Map<string, Set<(price: PriceData) => void>>();
let wsConnected = false;
let wsReconnectTimer: NodeJS.Timeout | null = null;

/**
 * Fetcher for SWR (REST fallback)
 */
const fetchPrices = async (symbols: string[]): Promise<Record<string, PriceData>> => {
  if (symbols.length === 0) return {};
  
  const response = await fetch('/api/market/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch prices: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Convert array to record
  const prices: Record<string, PriceData> = {};
  for (const quote of data.quotes) {
    prices[quote.symbol] = quote;
  }
  
  return prices;
};

/**
 * Initialize WebSocket connection
 */
const initWebSocket = (): WebSocket | null => {
  if (typeof window === 'undefined') return null;
  if (wsConnection?.readyState === WebSocket.OPEN) return wsConnection;
  if (wsConnection?.readyState === WebSocket.CONNECTING) return wsConnection;
  
  try {
    // Connect to our SSE endpoint or direct Alpaca through our proxy
    // Using SSE endpoint for better compatibility with Next.js
    const ws = new WebSocket(`wss://${window.location.host}/api/market/stream`);
    
    ws.onopen = () => {
      console.log('[useLivePrices] WebSocket connected');
      wsConnected = true;
      
      // Re-subscribe to all active symbols
      const allSymbols = Array.from(wsSubscribers.keys());
      if (allSymbols.length > 0) {
        ws.send(JSON.stringify({
          action: 'subscribe',
          symbols: allSymbols,
        }));
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'quote') {
          const price: PriceData = message.data;
          const handlers = wsSubscribers.get(price.symbol);
          if (handlers) {
            handlers.forEach(handler => handler(price));
          }
        }
      } catch (error) {
        console.error('[useLivePrices] Failed to parse message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[useLivePrices] WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('[useLivePrices] WebSocket disconnected');
      wsConnected = false;
      wsConnection = null;
      
      // Attempt reconnect
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(() => {
        if (wsSubscribers.size > 0) {
          initWebSocket();
        }
      }, 5000);
    };
    
    wsConnection = ws;
    return ws;
  } catch (error) {
    console.error('[useLivePrices] Failed to connect WebSocket:', error);
    return null;
  }
};

/**
 * Subscribe to WebSocket updates for symbols
 */
const subscribeToWebSocket = (
  symbols: string[],
  callback: (symbol: string, price: PriceData) => void
): (() => void) => {
  const upperSymbols = symbols.map(s => s.toUpperCase());
  
  // Register callbacks
  for (const symbol of upperSymbols) {
    if (!wsSubscribers.has(symbol)) {
      wsSubscribers.set(symbol, new Set());
    }
    
    // Create wrapper that includes symbol
    const handler = (price: PriceData) => callback(symbol, price);
    wsSubscribers.get(symbol)!.add(handler);
  }
  
  // Initialize connection if needed
  const ws = initWebSocket();
  
  // Send subscription message
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'subscribe',
      symbols: upperSymbols,
    }));
  }
  
  // Return unsubscribe function
  return () => {
    for (const symbol of upperSymbols) {
      const handlers = wsSubscribers.get(symbol);
      if (handlers) {
        // We need to find and remove the specific handler
        // Since we can't easily match the wrapped function, we'll clear all handlers for this symbol
        // and re-add any from other hook instances
        handlers.clear();
        wsSubscribers.delete(symbol);
      }
    }
    
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'unsubscribe',
        symbols: upperSymbols,
      }));
    }
    
    // Close connection if no more subscribers
    if (wsSubscribers.size === 0 && wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
  };
};

/**
 * Hook for real-time price updates with WebSocket and SWR fallback
 */
export function useLivePrices({
  symbols,
  enableWebSocket = true,
  pollIntervalMs = 5000,
  onPriceUpdate,
  onError,
}: UseLivePricesOptions): UseLivePricesResult {
  const [wsPrices, setWsPrices] = useState<Record<string, PriceData>>({});
  const [wsError, setWsError] = useState<Error | null>(null);
  const [isClient, setIsClient] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const subscribedSymbols = useRef<Set<string>>(new Set());
  
  // Track if component is mounted
  const isMounted = useRef(true);
  
  useEffect(() => {
    setIsClient(true);
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // SWR for REST fallback with automatic revalidation
  const { data: restPrices, error: restError, mutate } = useSWR(
    isClient && symbols.length > 0 ? ['prices', symbols] : null,
    () => fetchPrices(symbols),
    {
      refreshInterval: enableWebSocket && wsConnected ? 0 : pollIntervalMs, // Disable polling if WebSocket active
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  );
  
  // WebSocket subscription
  useEffect(() => {
    if (!isClient || !enableWebSocket || symbols.length === 0) {
      return;
    }
    
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    // Track subscribed symbols
    upperSymbols.forEach(s => subscribedSymbols.current.add(s));
    
    // Subscribe to WebSocket
    unsubscribeRef.current = subscribeToWebSocket(
      upperSymbols,
      (symbol, price) => {
        if (!isMounted.current) return;
        
        setWsPrices(prev => ({
          ...prev,
          [symbol]: price,
        }));
        
        if (onPriceUpdate) {
          onPriceUpdate(symbol, price);
        }
      }
    );
    
    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      subscribedSymbols.current.clear();
    };
  }, [isClient, enableWebSocket, symbols.join(','), onPriceUpdate]);
  
  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    if (!isClient || !enableWebSocket) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-establish WebSocket connection
        if (wsConnection?.readyState !== WebSocket.OPEN && subscribedSymbols.current.size > 0) {
          initWebSocket();
        }
        // Revalidate REST data
        mutate();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isClient, enableWebSocket, mutate]);
  
  // Merge WebSocket and REST prices (WebSocket takes precedence)
  const prices = useMemo((): Record<string, PriceData> => {
    const merged: Record<string, PriceData> = {};
    
    // Start with REST prices
    if (restPrices) {
      Object.assign(merged, restPrices);
    }
    
    // Override with WebSocket prices (more recent)
    Object.assign(merged, wsPrices);
    
    return merged;
  }, [restPrices, wsPrices]);
  
  // Get last updated timestamp
  const lastUpdatedValue = useMemo(() => {
    if (Object.keys(wsPrices).length > 0) {
      return new Date().toISOString();
    }
    return restPrices ? new Date().toISOString() : null;
  }, [wsPrices, restPrices]);
  
  // Error aggregation
  const error = wsError || restError || null;
  
  // Notify parent of errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);
  
  // Manual refetch
  const refetch = useCallback(() => {
    mutate();
  }, [mutate]);
  
  // Subscribe to additional symbols
  const subscribe = useCallback((newSymbols: string[]) => {
    if (!isClient || !enableWebSocket) return;
    
    const upperSymbols = newSymbols.map(s => s.toUpperCase());
    upperSymbols.forEach(s => subscribedSymbols.current.add(s));
    
    if (wsConnection?.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({
        action: 'subscribe',
        symbols: upperSymbols,
      }));
    }
  }, [isClient, enableWebSocket]);
  
  // Unsubscribe from symbols
  const unsubscribe = useCallback((removeSymbols: string[]) => {
    if (!isClient) return;
    
    const upperSymbols = removeSymbols.map(s => s.toUpperCase());
    upperSymbols.forEach(s => subscribedSymbols.current.delete(s));
    
    if (wsConnection?.readyState === WebSocket.OPEN) {
      wsConnection.send(JSON.stringify({
        action: 'unsubscribe',
        symbols: upperSymbols,
      }));
    }
    
    // Remove from local state
    setWsPrices(prev => {
      const next = { ...prev };
      upperSymbols.forEach(s => delete next[s]);
      return next;
    });
  }, [isClient]);
  
  return {
    prices,
    isConnected: wsConnected || !!restPrices,
    isWebSocketActive: wsConnected,
    error,
    lastUpdated: lastUpdatedValue,
    refetch,
    subscribe,
    unsubscribe,
  };
}

/**
 * Legacy hook for position-based live prices (backward compatible)
 */
interface LivePriceData {
  positionId: number;
  ticker: string;
  stockPrice: number | null;
  shortStrike: number;
  longStrike: number | null;
  strategy: string;
  contracts: number;
  currentPrice: number | null;
}

interface UsePositionPricesOptions {
  intervalMs?: number;
  positionIds?: number[];
  onError?: (error: Error) => void;
}

interface UsePositionPricesResult {
  data: LivePriceData[] | null;
  error: Error | null;
  isLoading: boolean;
  lastUpdated: number | null;
  refetch: () => void;
}

export function usePositionPrices({
  intervalMs = 60000,
  positionIds,
  onError,
}: UsePositionPricesOptions = {}): UsePositionPricesResult {
  const [data, setData] = useState<LivePriceData[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchLivePrices = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const params = new URLSearchParams();
      if (positionIds?.length) {
        params.set('ids', positionIds.join(','));
      }
      
      const url = `/api/positions/live-prices${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch live prices: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [positionIds, onError]);
  
  const refetch = useCallback(() => {
    fetchLivePrices();
  }, [fetchLivePrices]);
  
  useEffect(() => {
    fetchLivePrices();
    
    intervalRef.current = setInterval(fetchLivePrices, intervalMs);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLivePrices, intervalMs]);
  
  return {
    data,
    error,
    isLoading,
    lastUpdated,
    refetch,
  };
}

export default useLivePrices;
