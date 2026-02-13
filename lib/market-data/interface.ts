import { Quote, StockSnapshot, OptionSnapshot, Bar, QuoteHandler, OptionQuoteHandler } from './types';

export interface IMarketDataProvider {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Quotes & snapshots (REST)
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getSnapshot(symbol: string): Promise<StockSnapshot>;
  getOptionChain(underlying: string): Promise<OptionSnapshot[]>;
  
  // Historical data
  getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]>;
  
  // WebSocket subscriptions
  subscribeQuotes(symbols: string[], handler: QuoteHandler): void;
  subscribeOptionQuotes(symbols: string[], handler: OptionQuoteHandler): void;
  unsubscribe(symbols: string[]): void;
  unsubscribeAll(): void;
  
  // Metadata
  getEarningsCalendar?(start: Date, end: Date): Promise<EarningsEvent[]>;
  getOptionContracts?(underlying: string): Promise<OptionContract[]>;
}

export interface EarningsEvent {
  symbol: string;
  reportDate: string;
  reportTime: 'beforemkt' | 'aftermkt' | 'during';
  estimatedEPS?: number;
  actualEPS?: number;
}

export interface OptionContract {
  symbol: string;
  underlying: string;
  strike: number;
  expirationDate: string;
  optionType: 'call' | 'put';
}
