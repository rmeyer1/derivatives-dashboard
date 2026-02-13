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
export type Urgency = 'critical' | 'warning' | 'normal';

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
  itmPercent: number;
  dte: number;
  urgency: Urgency;
  acknowledgmentFlag: boolean;
  acknowledgmentExpiry: string | null;
  alertType: AlertType;
  managementPlan: string | null;
  rolledFromPositionId: number | null;
  closeDate: string | null;
  stockPrice?: number | null;
  entryPriceUnderlying?: number | null;
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
  acknowledgmentExpiry?: string | null;
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
  expiringSoonCount: number;
  risk_distribution: RiskDistribution[];
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
  shortStrike: number;
  longStrike?: number | null;
  dte: number;
  contracts: number;
}

export interface ITMAlert {
  positionId: number;
  ticker: string;
  strategy: string;
  shortStrike: number;
  longStrike: number | null;
  stockPrice: number;
  itmPercent: number;
  dte: number;
  urgency: Urgency;
  managementPlan: string | null;
  acknowledgmentFlag: boolean;
  acknowledgmentExpiry: string | null;
  acknowledgmentExpiryDays: number | null;
  entryCreditPerContract: number;
  contracts: number;
}

export interface LivePriceData {
  positionId: number;
  ticker: string;
  stockPrice: number | null;
  shortStrike: number;
  longStrike: number | null;
  strategy: string;
  contracts: number;
  currentPrice: number | null;
}
