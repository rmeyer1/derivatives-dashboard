// Provider factory

import { IMarketDataProvider } from './interface';
import { marketDataConfig } from './config';
import { AlpacaProvider } from './alpaca/provider';

export type ProviderName = 'alpaca' | 'polygon' | 'mock';

export const AVAILABLE_PROVIDERS: ProviderName[] = ['alpaca'];

export function createProvider(type?: ProviderName): IMarketDataProvider {
  const providerType = type || marketDataConfig.provider;

  switch (providerType) {
    case 'alpaca': {
      const alpaca = marketDataConfig.alpaca;
      if (!alpaca.apiKey || !alpaca.apiSecret) {
        throw new Error('Alpaca API key and secret must be configured');
      }
      return new AlpacaProvider({
        provider: 'alpaca',
        apiKey: alpaca.apiKey,
        apiSecret: alpaca.apiSecret,
        baseUrl: alpaca.dataUrl,
        maxStocks: marketDataConfig.limits.maxStockSubscriptions,
        maxOptions: marketDataConfig.limits.maxOptionSubscriptions,
        quoteCacheTtl: 5,
        snapshotCacheTtl: 30,
        optionCacheTtl: 60,
      });
    }

    case 'polygon':
      throw new Error('Polygon provider not yet implemented');

    case 'mock':
      throw new Error('Mock provider not yet implemented');

    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

export function createProviderWithConfig(
  name: ProviderName,
  config: Partial<{
    apiKey: string;
    apiSecret: string;
    baseUrl: string;
  }>
): IMarketDataProvider {
  const alpaca = marketDataConfig.alpaca;
  const apiKey = config.apiKey || alpaca.apiKey;
  const apiSecret = config.apiSecret || alpaca.apiSecret;
  
  if (!apiKey || !apiSecret) {
    throw new Error('Alpaca API key and secret must be configured');
  }
  
  return new AlpacaProvider({
    provider: 'alpaca',
    apiKey,
    apiSecret,
    baseUrl: config.baseUrl || alpaca.dataUrl,
    maxStocks: 30,
    maxOptions: 200,
    quoteCacheTtl: 5,
    snapshotCacheTtl: 30,
    optionCacheTtl: 60,
  });
}
