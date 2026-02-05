export interface PortfolioItem {
  id: string;
  symbol: string;
  type: 'Call' | 'Put';
  strike: number;
  expiration: string;
  quantity: number;
  avgPrice: number;
  marketPrice: number;
  pnl: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
}

export interface DMADataPoint {
  time: string;
  value: number;
}

export interface IVDataPoint {
  strike: number;
  iv: number;
}

export interface CreatePositionRequest {
  symbol: string;
  type: 'Call' | 'Put';
  strike: number;
  expiration: string;
  quantity: number;
  avgPrice: number;
}