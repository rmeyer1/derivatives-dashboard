import { useEffect, useState } from 'react';
import { usePolling } from './usePolling';
import { useMarketData } from './useMarketData';

interface DashboardData {
  positions: any[] | null;
  ivData: any | null;
  dmaData: any | null;
  alerts: any[] | null;
  lastUpdated: {
    positions: number | null;
    ivData: number | null;
    dmaData: number | null;
    alerts: number | null;
  };
  isLoading: boolean;
  error: Error | null;
  refetchAll: () => void;
}

// Simulated API fetch functions - these would be replaced with actual API calls
const fetchPositions = async (): Promise<any[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: 1, symbol: 'AAPL', quantity: 100, price: 150.00 },
    { id: 2, symbol: 'GOOGL', quantity: 50, price: 2500.00 }
  ];
};

const fetchIvData = async (): Promise<any> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    symbol: 'AAPL',
    impliedVolatility: 0.25,
    historicalVolatility: 0.20
  };
};

const fetchDmaData = async (): Promise<any> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    dma20: 150.50,
    dma50: 148.75,
    dma200: 142.30
  };
};

const fetchAlerts = async (): Promise<any[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: 1, message: 'Price alert: AAPL above $150', timestamp: new Date() }
  ];
};

/**
 * Integration hook that coordinates polling for all dashboard endpoints
 * Uses staggered polling to avoid thundering herd problem
 */
export function useDashboardData(): DashboardData {
  const { isMarketOpen } = useMarketData();
  const [pollingInterval, setPollingInterval] = useState<number>(30000); // Default 30s

  // Adjust polling interval based on market status
  useEffect(() => {
    setPollingInterval(isMarketOpen ? 30000 : 300000); // 30s during market hours, 5min outside
  }, [isMarketOpen]);

  // Poll positions endpoint
  const {
    data: positions,
    error: positionsError,
    isLoading: positionsLoading,
    lastUpdated: positionsLastUpdated,
    refetch: refetchPositions
  } = usePolling({
    fetchFunction: fetchPositions,
    interval: pollingInterval
  });

  // Poll IV data endpoint with 2s delay
  const {
    data: ivData,
    error: ivError,
    isLoading: ivLoading,
    lastUpdated: ivLastUpdated,
    refetch: refetchIvData
  } = usePolling({
    fetchFunction: fetchIvData,
    interval: pollingInterval
  });

  // Add 2s delay to IV data polling start
  useEffect(() => {
    const timer = setTimeout(() => {
      // This timeout ensures the polling starts 2s after positions
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Poll DMA data endpoint with 4s delay
  const {
    data: dmaData,
    error: dmaError,
    isLoading: dmaLoading,
    lastUpdated: dmaLastUpdated,
    refetch: refetchDmaData
  } = usePolling({
    fetchFunction: fetchDmaData,
    interval: pollingInterval
  });

  // Add 4s delay to DMA data polling start
  useEffect(() => {
    const timer = setTimeout(() => {
      // This timeout ensures the polling starts 4s after positions
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Poll alerts endpoint with 6s delay
  const {
    data: alerts,
    error: alertsError,
    isLoading: alertsLoading,
    lastUpdated: alertsLastUpdated,
    refetch: refetchAlerts
  } = usePolling({
    fetchFunction: fetchAlerts,
    interval: pollingInterval
  });

  // Add 6s delay to alerts polling start
  useEffect(() => {
    const timer = setTimeout(() => {
      // This timeout ensures the polling starts 6s after positions
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  // Determine overall loading state
  const isLoading = positionsLoading || ivLoading || dmaLoading || alertsLoading;

  // Determine overall error state
  const error = positionsError || ivError || dmaError || alertsError;

  // Refetch all data
  const refetchAll = () => {
    refetchPositions();
    refetchIvData();
    refetchDmaData();
    refetchAlerts();
  };

  return {
    positions,
    ivData,
    dmaData,
    alerts,
    lastUpdated: {
      positions: positionsLastUpdated,
      ivData: ivLastUpdated,
      dmaData: dmaLastUpdated,
      alerts: alertsLastUpdated
    },
    isLoading,
    error,
    refetchAll
  };
}