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

// SSE connection state
let sseConnection: EventSource | null = null;
let sseSubscribers = new Map<string, Set<(price: PriceData) => void>>();
let sseConnected = false;
let sseReconnectTimer: NodeJS.Timeout | null = null;

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
 * Initialize SSE connection
 */
const initSSE = (symbols: string[]): EventSource | null => {
  if (typeof window === 'undefined') return null;
  if (sseConnection?.readyState === EventSource.OPEN) return sseConnection;
  if (sseConnection?.readyState === EventSource.CONNECTING) return sseConnection;

  try {
    // Use EventSource for SSE (not WebSocket)
    const url = `/api/market/stream?symbols=${symbols.map(s => s.toUpperCase()).join(',')}`;
    const es = new EventSource(url);

    es.onopen = () => {
      console.log('[useLivePrices] SSE connected');
      sseConnected = true;
    };

    es.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'quote') {
          const price: PriceData = message.data;
          const handlers = sseSubscribers.get(price.symbol.toUpperCase());
          if (handlers) {
            handlers.forEach(handler => handler(price));
          }
        } else if (message.type === 'connected') {
          console.log('[useLivePrices] SSE session established:', message.clientId);
        }
      } catch (error) {
        console.error('[useLivePrices] Failed to parse SSE message:', error);
      }
    };

    es.onerror = (error) => {
      console.error('[useLivePrices] SSE error:', error);
      sseConnected = false;
      sseConnection = null;

      // Attempt reconnect
      if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
      sseReconnectTimer = setTimeout(() => {
        initSSE(symbols);
      }, 5000);
    };

    sseConnection = es;
    return es;
  } catch (error) {
    console.error('[useLivePrices] Failed to connect SSE:', error);
    return null;
  }
};

/**
 * Subscribe to SSE updates for symbols
 */
const subscribeToSSE = (
  symbols: string[],
  callback: (symbol: string, price: PriceData) => void
): (() => void) => {
  const upperSymbols = symbols.map(s => s.toUpperCase());

  // Register callbacks
  for (const symbol of upperSymbols) {
    if (!sseSubscribers.has(symbol)) {
      sseSubscribers.set(symbol, new Set());
    }

    const handler = (price: PriceData) => callback(symbol, price);
    sseSubscribers.get(symbol)!.add(handler);
  }

  // Initialize connection if needed
  initSSE(upperSymbols);

  // Return unsubscribe function
  return () => {
    for (const symbol of upperSymbols) {
      const handlers = sseSubscribers.get(symbol);
      if (handlers) {
        handlers.clear();
        sseSubscribers.delete(symbol);
      }
    }

    // Close connection if no more subscribers
    if (sseSubscribers.size === 0 && sseConnection) {
      sseConnection.close();
      sseConnection = null;
    }
  };
};

/**
 * Hook for real-time price updates with SSE and SWR fallback
 */
export function useLivePrices({
  symbols,
  enableWebSocket = true,
  pollIntervalMs = 5000,
  onPriceUpdate,
  onError,
}: UseLivePricesOptions): UseLivePricesResult {
  const [ssePrices, setSsePrices] = useState<Record<string, PriceData>>({});
  const [sseError, setSseError] = useState<Error | null>(null);
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
      refreshInterval: enableWebSocket && sseConnected ? 0 : pollIntervalMs,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  );

  // Create stable symbol key to prevent unnecessary re-subscriptions
  const symbolsKey = useMemo(() => {
    return [...symbols].map(s => s.toUpperCase()).sort().join(',');
  }, [symbols]);

  // Use a ref for onPriceUpdate to avoid re-subscribing when callback changes
  const onPriceUpdateRef = useRef(onPriceUpdate);
  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  // SSE subscription
  useEffect(() => {
    if (!isClient || !enableWebSocket || symbols.length === 0) {
      return;
    }

    const upperSymbols = symbols.map(s => s.toUpperCase());

    // Track subscribed symbols
    upperSymbols.forEach(s => subscribedSymbols.current.add(s));

    // Subscribe to SSE
    unsubscribeRef.current = subscribeToSSE(
      upperSymbols,
      (symbol, price) => {
        if (!isMounted.current) return;

        setSsePrices(prev => ({
          ...prev,
          [symbol]: price,
        }));

        if (onPriceUpdateRef.current) {
          onPriceUpdateRef.current(symbol, price);
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
  }, [isClient, enableWebSocket, symbolsKey]); // Removed onPriceUpdate from deps

  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    if (!isClient || !enableWebSocket) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (sseConnection?.readyState !== EventSource.OPEN && subscribedSymbols.current.size > 0) {
          initSSE(Array.from(subscribedSymbols.current));
        }
        mutate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isClient, enableWebSocket, mutate]);

  // Merge SSE and REST prices (SSE takes precedence)
  const prices = useMemo((): Record<string, PriceData> => {
    const merged: Record<string, PriceData> = {};

    // Start with REST prices
    if (restPrices) {
      Object.assign(merged, restPrices);
    }

    // Override with SSE prices (more recent)
    Object.assign(merged, ssePrices);

    return merged;
  }, [restPrices, ssePrices]);

  // Get last updated timestamp
  const lastUpdatedValue = useMemo(() => {
    if (Object.keys(ssePrices).length > 0) {
      return new Date().toISOString();
    }
    return restPrices ? new Date().toISOString() : null;
  }, [ssePrices, restPrices]);

  // Error aggregation
  const error = sseError || restError || null;

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

    // Re-init SSE with all subscribed symbols
    if (sseConnection) {
      sseConnection.close();
    }
    initSSE(Array.from(subscribedSymbols.current));
  }, [isClient, enableWebSocket]);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((removeSymbols: string[]) => {
    if (!isClient) return;

    const upperSymbols = removeSymbols.map(s => s.toUpperCase());
    upperSymbols.forEach(s => subscribedSymbols.current.delete(s));

    // Remove from local state
    setSsePrices(prev => {
      const next = { ...prev };
      upperSymbols.forEach(s => delete next[s]);
      return next;
    });
  }, [isClient]);

  return {
    prices,
    isConnected: sseConnected || !!restPrices,
    isWebSocketActive: sseConnected,
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