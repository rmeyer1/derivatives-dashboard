// Market data provider configuration

export type ProviderType = 'alpaca' | 'polygon' | 'mock';

interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paperTrading: boolean;
  dataUrl: string;
  feed: 'iex' | 'sip' | 'opra' | 'indicative';
}

interface PolygonConfig {
  apiKey: string;
}

interface LimitsConfig {
  maxStockSubscriptions: number;
  maxOptionSubscriptions: number;
  pollIntervalMs: number;
}

interface MarketDataConfig {
  provider: ProviderType;
  alpaca: AlpacaConfig;
  polygon: PolygonConfig;
  limits: LimitsConfig;
}

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

export const marketDataConfig: MarketDataConfig = {
  provider: (process.env.MARKET_DATA_PROVIDER as ProviderType) || 'alpaca',
  
  alpaca: {
    apiKey: getEnvVar('ALPACA_API_KEY'),
    apiSecret: getEnvVar('ALPACA_API_SECRET'),
    paperTrading: process.env.ALPACA_PAPER === 'true',
    dataUrl: process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets',
    feed: (process.env.ALPACA_FEED as AlpacaConfig['feed']) || 'iex',
  },
  
  polygon: {
    apiKey: getEnvVar('POLYGON_API_KEY', false),
  },
  
  limits: {
    // Alpaca Basic tier limits
    maxStockSubscriptions: 30,
    maxOptionSubscriptions: 200,
    pollIntervalMs: 60000,
  }
};

export function isValidConfig(): boolean {
  if (marketDataConfig.provider === 'alpaca') {
    return !!marketDataConfig.alpaca.apiKey && !!marketDataConfig.alpaca.apiSecret;
  }
  if (marketDataConfig.provider === 'polygon') {
    return !!marketDataConfig.polygon.apiKey;
  }
  return true; // mock provider always valid
}
