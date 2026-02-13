/**
 * Alpaca Market Data Provider
 * Implements IMarketDataProvider for Alpaca API
 */

import { IMarketDataProvider } from '../interface';
import { Quote, StockSnapshot, OptionSnapshot, Bar } from '../types';
import { AlpacaClient } from './client';
import { MarketDataProviderConfig } from '../types';

export class AlpacaProvider implements IMarketDataProvider {
  name = 'alpaca';
  private client: AlpacaClient;
  private config: MarketDataProviderConfig;
  private _connected = false;

  constructor(config: MarketDataProviderConfig) {
    this.config = config;
    this.client = new AlpacaClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Connect to Alpaca (validates credentials)
   */
  async connect(): Promise<void> {
    try {
      // Test connection by fetching a simple quote
      await this.client.getQuote('SPY');
      this._connected = true;
    } catch (error) {
      this._connected = false;
      throw new Error(
        `Failed to connect to Alpaca: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Disconnect from Alpaca
   */
  async disconnect(): Promise<void> {
    this._connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Map Alpaca quote to internal Quote format
   */
  private mapQuote(symbol: string, alpacaQuote: any): Quote {
    return {
      symbol,
      bidPrice: alpacaQuote.bp || 0,
      bidSize: alpacaQuote.bs || 0,
      askPrice: alpacaQuote.ap || 0,
      askSize: alpacaQuote.as || 0,
      lastPrice: 0, // Will be filled from trade if needed
      lastSize: 0,
      volume: 0,
      timestamp: alpacaQuote.t || new Date().toISOString(),
    };
  }

  /**
   * Map Alpaca trade to update Quote last price
   */
  private mapTradeToQuote(quote: Quote, alpacaTrade: any): Quote {
    return {
      ...quote,
      lastPrice: alpacaTrade.p || 0,
      lastSize: alpacaTrade.s || 0,
    };
  }

  /**
   * Map Alpaca bar to internal Bar format
   */
  private mapBar(symbol: string, alpacaBar: any): Bar {
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
    // Alpaca returns { symbol: "SPY", quote: { ap, as, bp, bs, t, ... } }
    const alpacaQuote = response.quote;
    const mapped = this.mapQuote(upperSymbol, alpacaQuote);

    // Try to get last price from trade
    try {
      const tradeResponse = await this.client.getTrade(upperSymbol);
      const trade = tradeResponse.trade;
      return this.mapTradeToQuote(mapped, trade);
    } catch {
      // Fall back to mid price if trade not available
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

    // Check limit
    if (symbols.length > this.config.maxStocks) {
      throw new Error(
        `Requested ${symbols.length} symbols but provider limit is ${this.config.maxStocks}. ` +
        'Consider upgrading your tier or batching requests.'
      );
    }

    const upperSymbols = symbols.map(s => s.toUpperCase());
    const quotesMap = await this.client.getQuotes(upperSymbols);
    
    const quotes: Quote[] = [];
    
    // Get trades for last price
    let tradesMap: Record<string, any> = {};
    try {
      tradesMap = await this.client.getTrades(upperSymbols);
    } catch {
      // Trades may not be available on all tiers
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

    // Check limit
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
   * Note: Options API requires paid plan on Alpaca
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
        const contract = await this.parseOptionSymbol(symbol);
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

      // Sort by strike then expiration
      snapshots.sort((a, b) => {
        if (a.strike !== b.strike) return a.strike - b.strike;
        return a.expirationDate.localeCompare(b.expirationDate);
      });

      return snapshots;
    } catch (error) {
      // Option API may not be available, return empty array
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
      lastPrice: (alpacaQuote.bp + alpacaQuote.ap) / 2, // Use mid price
      lastSize: 0,
      volume: 0,
      timestamp: alpacaQuote.t || new Date().toISOString(),
    };
  }

  /**
   * Parse option OCC symbol format (e.g., O:SPY250316C00580000)
   */
  private parseOptionSymbol(symbol: string): {
    underlying: string;
    expirationDate: string;
    optionType: 'call' | 'put';
    strike: number;
  } | null {
    // OCC format: O:SPY250316C00580000
    // Remove O: prefix
    const cleanSymbol = symbol.replace(/^O:/, '');
    
    // Match pattern: Underlying(3-6 chars) + YYMMDD + C/P + Strike(8 digits)
    // Strike is multiplied by 1000 (e.g., 00580000 = 580.00)
    const match = cleanSymbol.match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})(C|P)(\d{8})$/);
    
    if (!match) return null;
    
    const [, underlying, year, month, day, type, strikeStr] = match;
    
    // Convert 2-digit year to 4-digit
    const fullYear = parseInt(year, 10) >= 50 ? '19' + year : '20' + year;
    const expirationDate = `${fullYear}-${month}-${day}`;
    
    // Strike price divided by 1000
    const strike = parseInt(strikeStr, 10) / 1000;
    
    return {
      underlying,
      expirationDate,
      optionType: type === 'C' ? 'call' : 'put',
      strike,
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
    
    // Map common timeframe names to Alpaca format
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
}
