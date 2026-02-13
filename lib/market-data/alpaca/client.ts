// Alpaca REST API client

import { marketDataConfig } from '../config';
import { 
  AlpacaLatestQuoteResponse, 
  AlpacaLatestTradeResponse,
  AlpacaSnapshot 
} from './types';

export class AlpacaClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    const config = marketDataConfig.alpaca;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.dataUrl;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': this.apiKey,
        'APCA-API-SECRET-KEY': this.apiSecret,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getLatestQuote(symbol: string): Promise<AlpacaLatestQuoteResponse> {
    return this.request<AlpacaLatestQuoteResponse>(`/v2/stocks/${symbol}/quotes/latest`);
  }

  async getLatestTrade(symbol: string): Promise<AlpacaLatestTradeResponse> {
    return this.request<AlpacaLatestTradeResponse>(`/v2/stocks/${symbol}/trades/latest`);
  }

  async getSnapshot(symbol: string): Promise<AlpacaSnapshot> {
    return this.request<AlpacaSnapshot>(`/v2/stocks/${symbol}/snapshot`);
  }

  async getSnapshots(symbols: string[]): Promise<Record<string, AlpacaSnapshot>> {
    const symbolsParam = symbols.join(',');
    return this.request<Record<string, AlpacaSnapshot>>(`/v2/stocks/snapshots?symbols=${symbolsParam}`);
  }

  async getHistoricalBars(
    symbol: string, 
    timeframe: string = '1Day', 
    limit: number = 100
  ): Promise<any> {
    return this.request<any>(`/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}`);
  }
}