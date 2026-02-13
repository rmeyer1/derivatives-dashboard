/**
 * Alpaca Market Data Provider
 * Implements IMarketDataProvider for Alpaca API with WebSocket support
 */

import { IMarketDataProvider } from '../interface';
import { Quote, StockSnapshot, OptionSnapshot, Bar, QuoteHandler, OptionQuoteHandler } from '../types';
import { AlpacaClient, AlpacaQuote, AlpacaTrade, AlpacaBar, AlpacaSnapshot } from './client';
import { MarketDataProviderConfig } from '../types';
import { 
  AlpacaWebSocketManager, 
  AlpacaWsQuote, 
  AlpacaWsTrade,
  WebSocketConfig 
} from './websocket';
import { SubscriptionManager, toOCCSymbol, parseOCCSymbol } from '../subscription-manager';

interface ProviderQuoteHandler {
  symbol: string;
  handler: QuoteHandler;
}

interface ProviderOptionHandler {
  symbol: string;
  handler: OptionQuoteHandler;
}

// Simple event emitter for browser/edge compatibility
class SimpleEventEmitter {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }
  
  off(event: string, listener: (...args: any[]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  
  emit(event: string, ...args: any[]): boolean {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return false;
    
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[EventEmitter] Error in ${event} handler:`, error);
      }
    });
    return true;
  }
  
  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}

export class AlpacaProvider extends SimpleEventEmitter implements IMarketDataProvider {
  name = 'alpaca';
  private client: AlpacaClient;
  private config: MarketDataProviderConfig;
  private _connected = false;

  // WebSocket components
  private websocket: AlpacaWebSocketManager | null = null;
  private subscriptionManager: SubscriptionManager;
  private useWebSocket = false;

  // Handlers
  private stockHandlers = new Map<string, Set<QuoteHandler>>();
  private optionHandlers = new Map<string, Set<OptionQuoteHandler>>();

  // REST fallback interval
  private restPollInterval: NodeJS.Timeout | null = null;
  private restPollSymbols: Set<string> = new Set();

  // Price validation - track last known good prices to filter out bad data
  private lastGoodPrices = new Map<string, { bid: number; ask: number; timestamp: number }>();
  private readonly MAX_PRICE_DEVIATION = 0.50; // 50% deviation threshold

  constructor(config: MarketDataProviderConfig) {
    super();
    this.config = config;
    this.client = new AlpacaClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseUrl: config.baseUrl,
    });
    
    // Initialize subscription manager
    this.subscriptionManager = new SubscriptionManager({
      maxStocks: config.maxStocks,
      maxOptions: config.maxOptions,
    });
  }

  /**
   * Connect to Alpaca - enables WebSocket if available
   */
  async connect(useWebSocket: boolean = true): Promise<void> {
    try {
      // Test REST connection first
      await this.client.getQuote('SPY');
      this._connected = true;
      
      // Initialize WebSocket if requested
      if (useWebSocket) {
        await this.initializeWebSocket();
      }
    } catch (error) {
      this._connected = false;
      throw new Error(
        `Failed to connect to Alpaca: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Initialize WebSocket connection
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      const wsConfig: WebSocketConfig = {
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        feed: 'iex', // Free tier
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
      };
      
      this.websocket = new AlpacaWebSocketManager(wsConfig);
      this.useWebSocket = true;
      
      // Set up message handlers
      this.websocket.on('quote', (quote: AlpacaWsQuote) => {
        this.handleWebSocketQuote(quote);
      });
      
      this.websocket.on('trade', (trade: AlpacaWsTrade) => {
        this.handleWebSocketTrade(trade);
      });
      
      this.websocket.on('error', (error) => {
        console.error('[AlpacaProvider] WebSocket error:', error);
        this.emit('websocketError', error);
        
        // Fall back to REST polling on WebSocket error
        if (this.restPollSymbols.size > 0 && !this.restPollInterval) {
          this.startRestPolling();
        }
      });
      
      this.websocket.on('disconnected', () => {
        console.log('[AlpacaProvider] WebSocket disconnected');
        // Start REST polling as fallback
        if (this.restPollSymbols.size > 0 && !this.restPollInterval) {
          this.startRestPolling();
        }
      });
      
      this.websocket.on('connected', () => {
        console.log('[AlpacaProvider] WebSocket connected');
        // Stop REST polling if we have WebSocket
        this.stopRestPolling();
        
        // Re-subscribe to all active symbols
        this.resubscribeAll();
      });
      
      await this.websocket.connect();
      console.log('[AlpacaProvider] WebSocket initialized');
    } catch (error) {
      console.warn('[AlpacaProvider] WebSocket initialization failed, using REST only:', error);
      this.useWebSocket = false;
      this.websocket = null;
    }
  }
  
  /**
   * Handle WebSocket quote message
   */
  private handleWebSocketQuote(wsQuote: AlpacaWsQuote): void {
    const symbol = wsQuote.S;
    const quote: Quote = {
      symbol,
      bidPrice: wsQuote.bp,
      bidSize: wsQuote.bs,
      askPrice: wsQuote.ap,
      askSize: wsQuote.as,
      lastPrice: 0, // Will be updated by trade
      lastSize: 0,
      volume: 0,
      timestamp: wsQuote.t,
    };
    
    // Dispatch to handlers
    const handlers = this.stockHandlers.get(symbol);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(quote);
        } catch (error) {
          console.error(`[AlpacaProvider] Handler error for ${symbol}:`, error);
        }
      });
    }
    
    // Also dispatch through subscription manager
    this.subscriptionManager.dispatchUpdate({
      symbol,
      type: 'stock',
      bidPrice: quote.bidPrice,
      bidSize: quote.bidSize,
      askPrice: quote.askPrice,
      askSize: quote.askSize,
      timestamp: quote.timestamp,
    });
  }
  
  /**
   * Handle WebSocket trade message (updates last price)
   */
  private handleWebSocketTrade(wsTrade: AlpacaWsTrade): void {
    const symbol = wsTrade.S;
    
    // Update handlers with trade info
    const handlers = this.stockHandlers.get(symbol);
    if (handlers) {
      const tradeUpdate: Quote = {
        symbol,
        bidPrice: 0,
        bidSize: 0,
        askPrice: 0,
        askSize: 0,
        lastPrice: wsTrade.p,
        lastSize: wsTrade.s,
        volume: 0,
        timestamp: wsTrade.t,
      };
      
      handlers.forEach(handler => {
        try {
          handler(tradeUpdate);
        } catch (error) {
          console.error(`[AlpacaProvider] Trade handler error for ${symbol}:`, error);
        }
      });
    }
  }
  
  /**
   * Re-subscribe to all active symbols after reconnection
   */
  private resubscribeAll(): void {
    if (!this.websocket) return;
    
    // Get all subscribed symbols from subscription manager
    const { stocks, options } = this.subscriptionManager.getSubscriptions();
    
    if (stocks.length > 0) {
      this.websocket.subscribeQuotes(stocks);
      this.websocket.subscribeTrades(stocks);
    }
    
    // Options would be subscribed here if enabled
    if (options.length > 0) {
      console.log('[AlpacaProvider] Option subscriptions pending:', options.length);
    }
  }
  
  /**
   * Validate quote data - reject obvious outliers
   */
  private isValidQuote(quote: Quote): boolean {
    const midPrice = (quote.bidPrice + quote.askPrice) / 2;

    // Check for zero or negative prices
    if (quote.bidPrice <= 0 || quote.askPrice <= 0 || midPrice <= 0) {
      console.warn(`[AlpacaProvider] Rejecting invalid quote for ${quote.symbol}: bid=${quote.bidPrice}, ask=${quote.askPrice}`);
      return false;
    }

    // Check for excessive deviation from last known good price
    const lastGood = this.lastGoodPrices.get(quote.symbol);
    if (lastGood) {
      const lastMid = (lastGood.bid + lastGood.ask) / 2;
      const deviation = Math.abs(midPrice - lastMid) / lastMid;

      if (deviation > this.MAX_PRICE_DEVIATION) {
        console.warn(`[AlpacaProvider] Rejecting outlier for ${quote.symbol}: ` +
          `new=${midPrice.toFixed(2)}, last=${lastMid.toFixed(2)}, ` +
          `deviation=${(deviation * 100).toFixed(1)}%`);
        return false;
      }
    } else {
      // No cached price yet - apply first-price sanity checks to avoid caching bad data
      // Reject obviously wrong prices (under $1 for stocks, or unrealistic ranges)
      if (midPrice < 1.0) {
        console.warn(`[AlpacaProvider] Rejecting suspicious first price for ${quote.symbol}: ` +
          `mid=${midPrice.toFixed(2)} (likely bad data, waiting for valid quote)`);
        return false;
      }
    }

    return true;
  }

  /**
   * Store valid quote in cache - only call after isValidQuote returns true
   */
  private cacheGoodPrice(quote: Quote): void {
    this.lastGoodPrices.set(quote.symbol, {
      bid: quote.bidPrice,
      ask: quote.askPrice,
      timestamp: Date.now()
    });
  }

  /**
   * Start REST polling as fallback
   */
  private startRestPolling(): void {
    if (this.restPollInterval) return;

    console.log('[AlpacaProvider] Starting REST polling fallback');

    this.restPollInterval = setInterval(async () => {
      if (this.restPollSymbols.size === 0) return;

      const symbols = Array.from(this.restPollSymbols);
      console.log(`[AlpacaProvider] Polling for: ${symbols.join(',')}`);
      try {
        const quotes = await this.getQuotes(symbols);
        console.log(`[AlpacaProvider] Got ${quotes.length} quotes:`, quotes.map(q => `${q.symbol}@${q.bidPrice}/${q.askPrice}`));

        // Dispatch to handlers with validation
        quotes.forEach(quote => {
          // Validate the quote before dispatching
          const isValid = this.isValidQuote(quote);
          if (isValid) {
            // Cache the good price for future outlier detection
            this.cacheGoodPrice(quote);
          } else {
            // Use last known good price if available
            const lastGood = this.lastGoodPrices.get(quote.symbol);
            if (lastGood) {
              console.log(`[AlpacaProvider] Using last good price for ${quote.symbol}: ${lastGood.bid}/${lastGood.ask}`);
              // Create a new quote object with the last good prices
              quote = {
                symbol: quote.symbol,
                bidPrice: lastGood.bid,
                bidSize: quote.bidSize,
                askPrice: lastGood.ask,
                askSize: quote.askSize,
                lastPrice: (lastGood.bid + lastGood.ask) / 2,
                lastSize: quote.lastSize,
                volume: quote.volume,
                timestamp: new Date().toISOString(),
              };
            } else {
              // No good price known yet, skip this update
              console.log(`[AlpacaProvider] Skipping ${quote.symbol} - no valid price and no cache`);
              return;
            }
          }

          const handlers = this.stockHandlers.get(quote.symbol);
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(quote);
              } catch (error) {
                console.error(`[AlpacaProvider] Polling handler error:`, error);
              }
            });
          }
        });
      } catch (error) {
        console.error('[AlpacaProvider] REST polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }
  
  /**
   * Stop REST polling
   */
  private stopRestPolling(): void {
    if (this.restPollInterval) {
      clearInterval(this.restPollInterval);
      this.restPollInterval = null;
      console.log('[AlpacaProvider] Stopped REST polling');
    }
  }

  /**
   * Disconnect from Alpaca
   */
  async disconnect(): Promise<void> {
    this.stopRestPolling();
    
    if (this.websocket) {
      this.websocket.disconnect();
      this.websocket = null;
    }
    
    this.stockHandlers.clear();
    this.optionHandlers.clear();
    this.restPollSymbols.clear();
    this._connected = false;
    this.useWebSocket = false;
    this.removeAllListeners();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected;
  }
  
  /**
   * Check if WebSocket is active
   */
  isWebSocketActive(): boolean {
    return this.useWebSocket && this.websocket?.isConnected() === true;
  }

  /**
   * Map Alpaca quote to internal Quote format
   */
  private mapQuote(symbol: string, alpacaQuote: AlpacaQuote['quote']): Quote {
    return {
      symbol,
      bidPrice: alpacaQuote.bp || 0,
      bidSize: alpacaQuote.bs || 0,
      askPrice: alpacaQuote.ap || 0,
      askSize: alpacaQuote.as || 0,
      lastPrice: 0,
      lastSize: 0,
      volume: 0,
      timestamp: alpacaQuote.t || new Date().toISOString(),
    };
  }

  /**
   * Map Alpaca trade to update Quote last price
   */
  private mapTradeToQuote(quote: Quote, alpacaTrade: AlpacaTrade['trade']): Quote {
    return {
      ...quote,
      lastPrice: alpacaTrade.p || 0,
      lastSize: alpacaTrade.s || 0,
    };
  }

  /**
   * Map Alpaca bar to internal Bar format
   */
  private mapBar(symbol: string, alpacaBar: AlpacaBar): Bar {
    return {
      symbol,
      timestamp: alpacaBar.t,
      open: alpacaBar.o,
      high: alpacaBar.h,
      low: alpacaBar.l,
      close: alpacaBar.c,
      volume: alpacaBar.v,
      vwap: alpacaBar.vw,
      tradeCount: alpacaBar.n,
    };
  }

  /**
   * Get quote for a single symbol
   */
  async getQuote(symbol: string): Promise<Quote> {
    const upperSymbol = symbol.toUpperCase();
    const response = await this.client.getQuote(upperSymbol);
    const alpacaQuote = response.quote;
    const mapped = this.mapQuote(upperSymbol, alpacaQuote);

    // Try to get last price from trade
    try {
      const tradeResponse = await this.client.getTrade(upperSymbol);
      const trade = tradeResponse.trade;
      return this.mapTradeToQuote(mapped, trade);
    } catch {
      return {
        ...mapped,
        lastPrice: (mapped.bidPrice + mapped.askPrice) / 2,
      };
    }
  }

  /**
   * Get quotes for multiple symbols
   */
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) {
      return [];
    }

    if (symbols.length > this.config.maxStocks) {
      throw new Error(
        `Requested ${symbols.length} symbols but provider limit is ${this.config.maxStocks}. ` +
        'Consider upgrading your tier or batching requests.'
      );
    }

    const upperSymbols = symbols.map(s => s.toUpperCase());
    const quotesMap = await this.client.getQuotes(upperSymbols);
    
    const quotes: Quote[] = [];
    
    let tradesMap: Record<string, AlpacaTrade['trade']> = {};
    try {
      tradesMap = await this.client.getTrades(upperSymbols);
    } catch {
      // Trades may not be available
    }

    for (const symbol of upperSymbols) {
      const alpacaQuote = quotesMap[symbol];
      if (alpacaQuote) {
        let mapped = this.mapQuote(symbol, alpacaQuote);
        const trade = tradesMap[symbol];
        if (trade) {
          mapped = this.mapTradeToQuote(mapped, trade);
        } else {
          mapped.lastPrice = (mapped.bidPrice + mapped.askPrice) / 2;
        }
        quotes.push(mapped);
      }
    }

    return quotes;
  }

  /**
   * Get snapshot for a single symbol
   */
  async getSnapshot(symbol: string): Promise<StockSnapshot> {
    const upperSymbol = symbol.toUpperCase();
    const snapshot = await this.client.getSnapshot(upperSymbol);

    const quote = this.mapQuote(upperSymbol, snapshot.latestQuote);
    const trade = snapshot.latestTrade;
    const fullQuote = trade ? this.mapTradeToQuote(quote, trade) : quote;

    return {
      symbol: upperSymbol,
      quote: fullQuote,
      dailyBar: snapshot.dailyBar ? this.mapBar(upperSymbol, snapshot.dailyBar) : undefined,
      prevDailyBar: snapshot.prevDailyBar ? this.mapBar(upperSymbol, snapshot.prevDailyBar) : undefined,
      minuteBar: snapshot.minuteBar ? this.mapBar(upperSymbol, snapshot.minuteBar) : undefined,
    };
  }

  /**
   * Get snapshots for multiple symbols
   */
  async getSnapshots(symbols: string[]): Promise<StockSnapshot[]> {
    if (symbols.length === 0) {
      return [];
    }

    if (symbols.length > this.config.maxStocks) {
      throw new Error(
        `Requested ${symbols.length} symbols but provider limit is ${this.config.maxStocks}`
      );
    }

    const upperSymbols = symbols.map(s => s.toUpperCase());
    const snapshotsMap = await this.client.getSnapshots(upperSymbols);

    const snapshots: StockSnapshot[] = [];

    for (const symbol of upperSymbols) {
      const alpacaSnapshot = snapshotsMap[symbol];
      if (alpacaSnapshot) {
        const quote = this.mapQuote(symbol, alpacaSnapshot.latestQuote);
        const trade = alpacaSnapshot.latestTrade;
        const fullQuote = trade ? this.mapTradeToQuote(quote, trade) : quote;

        snapshots.push({
          symbol,
          quote: fullQuote,
          dailyBar: alpacaSnapshot.dailyBar ? this.mapBar(symbol, alpacaSnapshot.dailyBar) : undefined,
          prevDailyBar: alpacaSnapshot.prevDailyBar ? this.mapBar(symbol, alpacaSnapshot.prevDailyBar) : undefined,
          minuteBar: alpacaSnapshot.minuteBar ? this.mapBar(symbol, alpacaSnapshot.minuteBar) : undefined,
        });
      }
    }

    return snapshots;
  }

  /**
   * Get option chain for underlying symbol
   */
  async getOptionChain(
    underlying: string,
    expirationDate?: string
  ): Promise<OptionSnapshot[]> {
    const upperUnderlying = underlying.toUpperCase();
    
    try {
      const optionsMap = await this.client.getOptionSnapshots(
        upperUnderlying,
        expirationDate
      );

      const snapshots: OptionSnapshot[] = [];

      for (const [symbol, alpacaSnapshot] of Object.entries(optionsMap)) {
        const contract = parseOCCSymbol(symbol);
        if (!contract) continue;

        const quote = this.mapOptionQuote(symbol, alpacaSnapshot.latestQuote);

        snapshots.push({
          symbol,
          underlying: upperUnderlying,
          strike: contract.strike,
          expirationDate: contract.expirationDate,
          optionType: contract.optionType,
          quote,
          impliedVolatility: alpacaSnapshot.impliedVolatility,
          delta: alpacaSnapshot.greeks?.delta,
          gamma: alpacaSnapshot.greeks?.gamma,
          theta: alpacaSnapshot.greeks?.theta,
          vega: alpacaSnapshot.greeks?.vega,
          openInterest: alpacaSnapshot.openInterest,
        });
      }

      snapshots.sort((a, b) => {
        if (a.strike !== b.strike) return a.strike - b.strike;
        return a.expirationDate.localeCompare(b.expirationDate);
      });

      return snapshots;
    } catch (error) {
      console.warn(`Option chain not available for ${upperUnderlying}:`, error);
      return [];
    }
  }

  /**
   * Map Alpaca option quote to internal format
   */
  private mapOptionQuote(symbol: string, alpacaQuote: any): Quote {
    return {
      symbol,
      bidPrice: alpacaQuote.bp || 0,
      bidSize: alpacaQuote.bs || 0,
      askPrice: alpacaQuote.ap || 0,
      askSize: alpacaQuote.as || 0,
      lastPrice: (alpacaQuote.bp + alpacaQuote.ap) / 2,
      lastSize: 0,
      volume: 0,
      timestamp: alpacaQuote.t || new Date().toISOString(),
    };
  }

  /**
   * Get historical bars
   */
  async getBars(
    symbol: string,
    timeframe: string,
    start: string,
    end?: string,
    limit?: number
  ): Promise<Bar[]> {
    const upperSymbol = symbol.toUpperCase();
    
    const timeframeMap: Record<string, string> = {
      '1Min': '1Min',
      '5Min': '5Min',
      '15Min': '15Min',
      '30Min': '30Min',
      '1Hour': '1Hour',
      '4Hour': '4Hour',
      '1Day': '1Day',
      '1Week': '1Week',
      '1Month': '1Month',
    };

    const alpacaTimeframe = timeframeMap[timeframe] || timeframe;
    
    const bars = await this.client.getBars(
      upperSymbol,
      alpacaTimeframe,
      start,
      end,
      limit
    );

    return bars.map(bar => this.mapBar(upperSymbol, bar));
  }

  /**
   * Get historical bars (interface method)
   */
  async getHistoricalBars(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<Bar[]> {
    // Calculate start date based on limit and timeframe
    const now = new Date();
    let daysBack = limit;
    
    // Rough calculation for different timeframes
    if (timeframe.includes('Min')) {
      const minutes = parseInt(timeframe);
      daysBack = Math.ceil((minutes * limit) / (60 * 24));
    } else if (timeframe.includes('Hour')) {
      const hours = parseInt(timeframe);
      daysBack = Math.ceil((hours * limit) / 24);
    } else if (timeframe.includes('Week')) {
      daysBack = limit * 7;
    } else if (timeframe.includes('Month')) {
      daysBack = limit * 30;
    }
    
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return this.getBars(symbol, timeframe, start, undefined, limit);
  }

  // WebSocket subscription methods

  /**
   * Subscribe to real-time quotes for stock symbols
   */
  subscribeQuotes(symbols: string[], handler: QuoteHandler): void {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    // Register with subscription manager
    const { subscribed, errors } = this.subscriptionManager.subscribeStocks(
      upperSymbols,
      (update) => {
        const quote: Quote = {
          symbol: update.symbol,
          bidPrice: update.bidPrice,
          bidSize: update.bidSize,
          askPrice: update.askPrice,
          askSize: update.askSize,
          lastPrice: 0,
          lastSize: 0,
          volume: 0,
          timestamp: update.timestamp,
        };
        handler(quote);
      },
      1 // Default priority
    );
    
    // Store handlers for direct dispatch
    for (const symbol of upperSymbols) {
      if (!this.stockHandlers.has(symbol)) {
        this.stockHandlers.set(symbol, new Set());
      }
      this.stockHandlers.get(symbol)!.add(handler);
      this.restPollSymbols.add(symbol);
    }
    
    // Subscribe via WebSocket if available
    if (this.websocket?.isConnected()) {
      this.websocket.subscribeQuotes(subscribed);
      this.websocket.subscribeTrades(subscribed);
    } else {
      // Fall back to REST polling
      if (!this.restPollInterval) {
        this.startRestPolling();
      }
    }
    
    // Log any errors
    errors.forEach(error => {
      console.warn('[AlpacaProvider] Subscription error:', error);
    });
  }

  /**
   * Subscribe to real-time quotes for option symbols
   */
  subscribeOptionQuotes(symbols: string[], handler: OptionQuoteHandler): void {
    // Normalize to OCC format
    const occSymbols = symbols.map(s => {
      if (s.startsWith('O:')) return s.toUpperCase();
      return s.toUpperCase(); // Assume already in OCC format without prefix
    });
    
    const { subscribed, errors } = this.subscriptionManager.subscribeOptions(
      occSymbols,
      (update) => {
        // Parse OCC to get option details
        const parsed = parseOCCSymbol(update.symbol);
        if (!parsed) return;
        
        const optionSnapshot: OptionSnapshot = {
          symbol: update.symbol,
          underlying: parsed.ticker,
          strike: parsed.strike,
          expirationDate: parsed.expirationDate,
          optionType: parsed.optionType,
          quote: {
            symbol: update.symbol,
            bidPrice: update.bidPrice,
            bidSize: update.bidSize,
            askPrice: update.askPrice,
            askSize: update.askSize,
            lastPrice: 0,
            lastSize: 0,
            volume: 0,
            timestamp: update.timestamp,
          },
        };
        handler(optionSnapshot);
      }
    );
    
    // Store handlers
    for (const symbol of occSymbols) {
      if (!this.optionHandlers.has(symbol)) {
        this.optionHandlers.set(symbol, new Set());
      }
      this.optionHandlers.get(symbol)!.add(handler);
    }
    
    // Note: Options WebSocket requires paid tier
    // For now, options are REST-only
    console.log('[AlpacaProvider] Option subscriptions use REST polling (WebSocket options require paid tier)');
    
    errors.forEach(error => {
      console.warn('[AlpacaProvider] Option subscription error:', error);
    });
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[]): void {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    // Remove from subscription manager
    this.subscriptionManager.unsubscribe(upperSymbols);
    
    // Remove from WebSocket
    if (this.websocket?.isConnected()) {
      this.websocket.unsubscribe(upperSymbols);
    }
    
    // Remove handlers
    for (const symbol of upperSymbols) {
      this.stockHandlers.delete(symbol);
      this.optionHandlers.delete(symbol);
      this.restPollSymbols.delete(symbol);
    }
    
    // Stop REST polling if no more symbols
    if (this.restPollSymbols.size === 0) {
      this.stopRestPolling();
    }
  }

  /**
   * Unsubscribe from all symbols
   */
  unsubscribeAll(): void {
    // Clear subscription manager
    this.subscriptionManager.unsubscribeAll();
    
    // Unsubscribe WebSocket
    if (this.websocket?.isConnected()) {
      this.websocket.unsubscribeAll();
    }
    
    // Clear handlers
    this.stockHandlers.clear();
    this.optionHandlers.clear();
    this.restPollSymbols.clear();
    
    // Stop REST polling
    this.stopRestPolling();
  }
  
  /**
   * Get current subscription status
   */
  getSubscriptionStatus(): {
    stocks: string[];
    options: string[];
    websocketActive: boolean;
    restPollingActive: boolean;
  } {
    const { stocks, options } = this.subscriptionManager.getSubscriptions();
    
    return {
      stocks,
      options,
      websocketActive: this.isWebSocketActive(),
      restPollingActive: this.restPollInterval !== null,
    };
  }
  
  /**
   * Get toOCCSymbol helper
   */
  static toOCCSymbol(
    ticker: string,
    expirationDate: string,
    optionType: 'call' | 'put',
    strike: number
  ): string {
    return toOCCSymbol(ticker, expirationDate, optionType, strike);
  }
  
  /**
   * Get parseOCCSymbol helper
   */
  static parseOCCSymbol(occSymbol: string): {
    ticker: string;
    expirationDate: string;
    optionType: 'call' | 'put';
    strike: number;
  } | null {
    return parseOCCSymbol(occSymbol);
  }
}