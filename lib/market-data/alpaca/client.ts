// Alpaca REST API client

export interface AlpacaClientConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export interface AlpacaQuote {
  symbol: string;
  quote: {
    ap: number;   // ask price
    as: number;   // ask size
    ax: string;   // ask exchange
    bp: number;   // bid price
    bs: number;   // bid size
    bx: string;   // bid exchange
    t: string;    // timestamp ISO
  };
}

export interface AlpacaTrade {
  symbol: string;
  trade: {
    p: number;    // price
    s: number;    // size
    t: string;    // timestamp
    x: string;    // exchange
  };
}

export interface AlpacaSnapshot {
  symbol: string;
  latestQuote: AlpacaQuote['quote'];
  latestTrade: {
    p: number;
    s: number;
    t: string;
    x: string;
  };
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

export interface AlpacaBar {
  t: string;     // timestamp
  o: number;     // open
  h: number;     // high
  l: number;     // low
  c: number;     // close
  v: number;     // volume
  vw?: number;   // vwap
  n?: number;    // trade count
}

export class AlpacaClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(config: AlpacaClientConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl;
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

  // Single quote
  async getQuote(symbol: string): Promise<AlpacaQuote> {
    return this.request<AlpacaQuote>(`/v2/stocks/${symbol.toUpperCase()}/quotes/latest`);
  }

  // Batch quotes
  async getQuotes(symbols: string[]): Promise<Record<string, AlpacaQuote['quote']>> {
    const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
    const response = await this.request<Record<string, { quote: AlpacaQuote['quote'] }>>(
      `/v2/stocks/quotes/latest?symbols=${symbolsParam}`
    );
    // Flatten the response to just the quote objects
    const result: Record<string, AlpacaQuote['quote']> = {};
    for (const [symbol, data] of Object.entries(response)) {
      result[symbol] = data.quote;
    }
    return result;
  }

  // Single trade
  async getTrade(symbol: string): Promise<AlpacaTrade> {
    return this.request<AlpacaTrade>(`/v2/stocks/${symbol.toUpperCase()}/trades/latest`);
  }

  // Batch trades
  async getTrades(symbols: string[]): Promise<Record<string, AlpacaTrade['trade']>> {
    const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
    const response = await this.request<Record<string, { trade: AlpacaTrade['trade'] }>>(
      `/v2/stocks/trades/latest?symbols=${symbolsParam}`
    );
    // Flatten the response
    const result: Record<string, AlpacaTrade['trade']> = {};
    for (const [symbol, data] of Object.entries(response)) {
      result[symbol] = data.trade;
    }
    return result;
  }

  // Single snapshot
  async getSnapshot(symbol: string): Promise<AlpacaSnapshot> {
    const response = await this.request<any>(`/v2/stocks/${symbol.toUpperCase()}/snapshot`);
    return { symbol: symbol.toUpperCase(), ...response };
  }

  // Batch snapshots
  async getSnapshots(symbols: string[]): Promise<Record<string, AlpacaSnapshot>> {
    const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
    const response = await this.request<Record<string, any>>(`/v2/stocks/snapshots?symbols=${symbolsParam}`);
    // Add symbol to each snapshot
    const result: Record<string, AlpacaSnapshot> = {};
    for (const [symbol, data] of Object.entries(response)) {
      result[symbol] = { symbol, ...data };
    }
    return result;
  }

  // Option snapshots (require options subscription on Alpaca)
  async getOptionSnapshots(
    underlying: string,
    expiration?: string
  ): Promise<Record<string, any>> {
    // This requires options API access (paid feature)
    let endpoint = `/v1beta1/options/snapshots/${underlying.toUpperCase()}`;
    if (expiration) {
      endpoint += `?expiration_date=${expiration}`;
    }
    return this.request<Record<string, any>>(endpoint);
  }

  // Historical bars
  async getBars(
    symbol: string,
    timeframe: string = '1Day',
    start: string,
    end?: string,
    limit?: number
  ): Promise<AlpacaBar[]> {
    let endpoint = `/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=${timeframe}`;
    if (start) endpoint += `&start=${start}`;
    if (end) endpoint += `&end=${end}`;
    if (limit) endpoint += `&limit=${limit}`;

    const response = await this.request<{ bars: AlpacaBar[] }>(endpoint);
    return response.bars || [];
  }
}
