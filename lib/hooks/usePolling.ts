import { useState, useEffect, useCallback, useRef } from 'react';

interface PollingOptions<T> {
  fetchFunction: () => Promise<T>;
  interval?: number;
  onError?: (error: Error) => void;
}

interface PollingResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  lastUpdated: number | null;
  refetch: () => void;
}

/**
 * Generic polling hook with exponential backoff and tab visibility awareness
 * @param options - Polling configuration
 * @returns PollingResult - Current polling state and controls
 */
export function usePolling<T>({
  fetchFunction,
  interval = 30000, // Default 30 seconds
  onError
}: PollingOptions<T>): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(interval);
  const fetchFunctionRef = useRef(fetchFunction);
  
  // Update ref when fetchFunction changes
  useEffect(() => {
    fetchFunctionRef.current = fetchFunction;
  }, [fetchFunction]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchFunctionRef.current();
      setData(result);
      setError(null);
      setLastUpdated(Date.now());
      // Reset interval on successful fetch
      currentIntervalRef.current = interval;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Double the interval on error, up to 5 minutes maximum
      currentIntervalRef.current = Math.min(currentIntervalRef.current * 2, 300000);
      if (onError) {
        onError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [interval, onError]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Handle polling when tab is visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refetch immediately when tab becomes visible
        fetchData();
        // Restart polling interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(fetchData, currentIntervalRef.current);
      } else {
        // Clear interval when tab is hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    // Set up visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial fetch
    fetchData();

    // Start polling interval
    intervalRef.current = setInterval(fetchData, currentIntervalRef.current);

    // Clean up on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, interval]);

  return {
    data,
    error,
    isLoading,
    lastUpdated,
    refetch
  };
}