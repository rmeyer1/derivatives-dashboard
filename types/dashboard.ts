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

export interface CreatePositionRequest {
  symbol: string;
  type: 'Call' | 'Put';
  strike: number;
  expiration: string; // ISO date format
  quantity: number;
  avg_price: number; // premium received
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

// Mobile-specific types
export type MobileTab = 'dashboard' | 'positions' | 'alerts' | 'journal';

// Push Notification types
export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
}

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationRegistrationResponse {
  success: boolean;
  message: string;
  endpoints?: string[];
}

export interface NotificationSendResponse {
  success: boolean;
  recipients: number;
  sent: boolean;
  results?: Array<{
    endpoint: string;
    success: boolean;
    error?: string;
  }>;
}
