export type AgentActivityType = 
  | 'research'
  | 'alert'
  | 'trade_suggestion'
  | 'analysis'
  | 'notification'
  | 'system';

export type AgentActivityStatus = 'completed' | 'pending' | 'failed';

export interface AgentActivity {
  id: string;
  type: AgentActivityType;
  description: string;
  timestamp: string;
  status: AgentActivityStatus;
  metadata?: {
    ticker?: string;
    reportUrl?: string;
    level?: string;
    type?: string;
    ideas?: number;
    event?: string;
    analysisType?: string;
    tickers?: string[];
    [key: string]: string | number | string[] | undefined;
  };
}

export type TaskType = 'research' | 'price_alert' | 'manual';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  ticker?: string;
  targetPrice?: number;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  result?: string;
}

export type PositionType = 'long' | 'short';
export type TradeType = 'call' | 'put' | 'stock';
export type ApprovalStatus = 'pending' | 'approved' | 'declined';

export interface TradeSuggestion {
  id: string;
  symbol: string;
  positionType: PositionType;
  tradeType: TradeType;
  suggestedSize: number;
  entryPrice?: number;
  strikePrice?: number;
  expiration?: string;
  reasoning: string;
  confidence: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  suggestedAt: string;
}

export interface TradeApproval {
  id: string;
  suggestion: TradeSuggestion;
  status: ApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
  executed: boolean;
}

export interface AgentActionsResponse {
  activities: AgentActivity[];
  total: number;
  hasMore: boolean;
}

export interface TasksResponse {
  tasks: Task[];
  total: number;
}

export interface ApprovalsResponse {
  pending: TradeApproval[];
  history: TradeApproval[];
  pendingCount: number;
}
