/**
 * Market Data Provider Factory
 * Creates the appropriate provider based on configuration
 */

import { IMarketDataProvider } from './interface';
import { AlpacaProvider } from './alpaca/provider';
import { loadMarketDataConfig } from './config';

/**
 * Create a market data provider based on environment configuration
 */
export function createProvider(): IMarketDataProvider {
  const config = loadMarketDataConfig();

  switch (config.provider) {
    case 'alpaca':
      return new AlpacaProvider(config);
    default:
      throw new Error(`Unsupported market data provider: ${config.provider}`);
  }
}

/**
 * Create a provider with explicit configuration
 * Useful for testing or when config differs from env
 */
export function createProviderWithConfig(
  providerName: 'alpaca',
  overrides?: Partial<ReturnType<typeof loadMarketDataConfig>>
): IMarketDataProvider {
  const config = loadMarketDataConfig();
  
  const mergedConfig = {
    ...config,
    ...overrides,
    provider: providerName,
  };

  switch (providerName) {
    case 'alpaca':
      return new AlpacaProvider(mergedConfig);
    default:
      throw new Error(`Unsupported market data provider: ${providerName}`);
  }
}

/**
 * Register available providers
 */
export const AVAILABLE_PROVIDERS = ['alpaca'] as const;

export type ProviderName = typeof AVAILABLE_PROVIDERS[number];
