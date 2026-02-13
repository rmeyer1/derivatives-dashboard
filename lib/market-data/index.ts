/**
 * Market Data Module - Public Exports
 */

// Types
export type {
  Quote,
  StockSnapshot,
  OptionSnapshot,
  Bar,
  MarketDataCacheEntry,
  MarketDataProviderConfig,
} from './types';

// Interface
export type { IMarketDataProvider } from './interface';

// Configuration
export {
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
export type {
  AlpacaQuote,
  AlpacaTrade,
  AlpacaBar,
  AlpacaSnapshot,
  AlpacaOptionSnapshot,
  AlpacaOptionContract,
} from './alpaca/types';
