// Market Data Module - Public Exports

// Types
export type {
  Quote,
  StockSnapshot,
  OptionSnapshot,
  Bar,
} from './types';

// Interface
export type { IMarketDataProvider } from './interface';

// Configuration
export {
  marketDataConfig,
  isValidConfig,
  loadMarketDataConfig,
  getConfiguredProvider,
  isMarketDataConfigured,
  getConfigSummary,
} from './config';

// Factory
export {
  createProvider,
  createProviderWithConfig,
  AVAILABLE_PROVIDERS,
  type ProviderName,
} from './factory';

// Providers
export { AlpacaProvider } from './alpaca/provider';
export { AlpacaClient } from './alpaca/client';
export type {
  AlpacaQuote,
  AlpacaTrade,
  AlpacaBar,
  AlpacaSnapshot,
} from './alpaca/types';

// WebSocket
export {
  AlpacaWebSocketManager,
  type AlpacaWsQuote,
  type AlpacaWsTrade,
  type AlpacaWsBar,
  type WebSocketConfig,
} from './alpaca/websocket';

// Subscription Manager
export {
  SubscriptionManager,
  toOCCSymbol,
  parseOCCSymbol,
  type SubscriptionLimits,
  type QuoteUpdate,
  type SubscriptionError,
} from './subscription-manager';

// Convenience singleton
import { createProvider } from './factory';
export const marketData = createProvider();
