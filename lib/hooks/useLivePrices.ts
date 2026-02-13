'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

interface UseLivePricesOptions {
  intervalMs?: number;
  positionIds?: number[];
  onError?: (error: Error) => void;
}

interface UseLivePricesResult {
  data: LivePriceData[] | null;
  error: Error | null;
  isLoading: boolean;
  lastUpdated: number | null;
  refetch: () => void;
}

/**
 * Custom hook for polling live prices for positions
 * Uses 60 second interval by default
 */
export function useLivePrices({
  intervalMs = 60000,
  positionIds,
  onError
}: UseLivePricesOptions = {}): UseLivePricesResult {
  const [data, setData] = useState<LivePriceData[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchLivePrices = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (positionIds?.length) {
        params.set('ids', positionIds.join(','));
      }
      
      const url = `/api/positions/live-prices${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        cache: 'no-store'
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
    // Initial fetch
    fetchLivePrices();
    
    // Set up polling interval
    intervalRef.current = setInterval(fetchLivePrices, intervalMs);
    
    // Cleanup on unmount
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
    refetch
  };
}

export default useLivePrices;
