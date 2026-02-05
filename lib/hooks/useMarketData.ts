import { useState, useEffect } from 'react';
import { isMarketOpen as checkMarketOpen } from '../utils/marketHours';

interface MarketData {
  isMarketOpen: boolean;
}

/**
 * Hook to determine if the market is currently open
 * Checks market hours (9:30-16:00 EST, Mon-Fri) and accounts for holidays
 */
export function useMarketData(): MarketData {
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(checkMarketOpen());

  useEffect(() => {
    // Check market status immediately
    setIsMarketOpen(checkMarketOpen());
    
    // Set up interval to check market status every minute
    const interval = setInterval(() => {
      setIsMarketOpen(checkMarketOpen());
    }, 60000); // Check every minute

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  return {
    isMarketOpen
  };
}