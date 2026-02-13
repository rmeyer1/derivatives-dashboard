/**
 * Cached Market Data Provider
 * Wraps any provider with database-backed caching
 */

import { IMarketDataProvider } from './interface';
import { Quote, StockSnapshot, OptionSnapshot, Bar } from './types';
import { MarketDataProviderConfig } from './types';
import {
  getCachedQuote,
  cacheQuote,
  getCachedSnapshot,
  cacheSnapshot,
  getCachedOptionChain,
  cacheOptionChain,
} from './cache';

export class CachedProvider implements IMarketDataProvider {
  name: string;
  private provider: IMarketDataProvider;
  private config: MarketDataProviderConfig;
  private _connected = false;

  constructor(provider: IMarketDataProvider, config: MarketDataProviderConfig) {
    this.provider = provider;
    this.config = config;
    this.name = `${provider.name}-cached`;
  }

  /**
   * Connect to underlying provider
   */
  async connect(): Promise<void> {
    await this.provider.connect();
    this._connected = true;
  }

  /**
   * Disconnect from underlying provider
   */
  async disconnect(): Promise<void> {
    await this.provider.disconnect();
    this._connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected && this.provider.isConnected();
  }

  /**
   * Get quote (with caching)
   */
  async getQuote(symbol: string): Promise<Quote> {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    const cached = getCachedQuote(upperSymbol, this.config.provider);
    if (cached) {
      return cached;
    }

    // Fetch from provider
    const quote = await this.provider.getQuote(upperSymbol);
    
    // Cache the result
    cacheQuote(quote, this.config.provider, this.config.quoteCacheTtl);
    
    return quote;
  }

  /**
   * Get multiple quotes
   * Note: Individual quotes are cached separately
   */
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    const results: Quote[] = [];
    const missing: string[] = [];

    // Check cache for each symbol
    for (const symbol of upperSymbols) {
      const cached = getCachedQuote(symbol, this.config.provider);
      if (cached) {
        results.push(cached);
      } else {
        missing.push(symbol);
      }
    }

    // Fetch missing quotes
    if (missing.length > 0) {
      try {
        const fetched = await this.provider.getQuotes(missing);
        for (const quote of fetched) {
          cacheQuote(quote, this.config.provider, this.config.quoteCacheTtl);
          results.push(quote);
        }
      } catch (error) {
        // If batch fails, try individual fetches
        for (const symbol of missing) {
          try {
            const quote = await this.provider.getQuote(symbol);
            cacheQuote(quote, this.config.provider, this.config.quoteCacheTtl);
            results.push(quote);
          } catch (individualError) {
            console.warn(`Failed to fetch quote for ${symbol}:`, individualError);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get snapshot (with caching)
   */
  async getSnapshot(symbol: string): Promise<StockSnapshot> {
    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    const cached = getCachedSnapshot(upperSymbol, this.config.provider);
    if (cached) {
      return cached;
    }

    // Fetch from provider
    const snapshot = await this.provider.getSnapshot(upperSymbol);
    
    // Cache the result
    cacheSnapshot(snapshot, this.config.provider, this.config.snapshotCacheTtl);
    
    return snapshot;
  }

  /**
   * Get multiple snapshots
   */
  async getSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    const results: StockSnapshot[] = [];
    const missing: string[] = [];

    // Check cache for each symbol
    for (const symbol of upperSymbols) {
      const cached = getCachedSnapshot(symbol, this.config.provider);
      if (cached) {
        results.push(cached);
      } else {
        missing.push(symbol);
      }
    }

    // Fetch missing snapshots
    if (missing.length > 0) {
      try {
        const fetched = await this.provider.getSnapshots(missing);
        for (const snapshot of fetched) {
          cacheSnapshot(snapshot, this.config.provider, this.config.snapshotCacheTtl);
          results.push(snapshot);
        }
      } catch (error) {
        // If batch fails, try individual fetches
        for (const symbol of missing) {
          try {
            const snapshot = await this.provider.getSnapshot(symbol);
            cacheSnapshot(snapshot, this.config.provider, this.config.snapshotCacheTtl);
            results.push(snapshot);
          } catch (individualError) {
            console.warn(`Failed to fetch snapshot for ${symbol}:`, individualError);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get option chain (with caching)
   */
  async getOptionChain(
    underlying: string,
    expirationDate?: string
  ): Promise<OptionSnapshot[]> {
    const upperUnderlying = underlying.toUpperCase();
    
    // Check cache first
    const cached = getCachedOptionChain(
      upperUnderlying,
      this.config.provider,
      expirationDate
    );
    if (cached) {
      return cached;
    }

    // Fetch from provider
    const options = await this.provider.getOptionChain(upperUnderlying, expirationDate);
    
    // Cache the result
    cacheOptionChain(
      upperUnderlying,
      options,
      this.config.provider,
      this.config.optionCacheTtl,
      expirationDate
    );
    
    return options;
  }

  /**
   * Get historical bars (not cached - time series data is unique per request)
   */
  async getBars(
    symbol: string,
    timeframe: string,
    start: string,
    end?: string,
    limit?: number
  ): Promise<Bar[]> {
    return this.provider.getBars(symbol, timeframe, start, end, limit);
  }
}

/**
 * Create a cached provider wrapper
 */
export function withCaching(
  provider: IMarketDataProvider,
  config: MarketDataProviderConfig
): IMarketDataProvider {
  return new CachedProvider(provider, config);
}
