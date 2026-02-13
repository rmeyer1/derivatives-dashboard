/**
 * Option chain API endpoint
 * Fetches option chain data for a ticker and expiration date
 */

import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  // Check if market data is configured
  if (!isValidConfig()) {
    return NextResponse.json(
      { error: 'Market data provider not configured' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const expiration = searchParams.get('expiration');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required parameter: ticker' },
        { status: 400 }
      );
    }

    console.log(`[API /market/options] Fetching options for ${ticker} ${expiration || 'all expirations'}`);

    // Fetch option chain from provider
    const options = await marketData.getOptionChain(ticker.toUpperCase(), expiration || undefined);

    console.log(`[API /market/options] Found ${options.length} options for ${ticker}`);

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      expiration: expiration || null,
      count: options.length,
      options: options.map(opt => ({
        symbol: opt.symbol,
        underlying: opt.underlying,
        strike: opt.strike,
        expirationDate: opt.expirationDate,
        optionType: opt.optionType,
        quote: opt.quote,
        impliedVolatility: opt.impliedVolatility,
        greeks: {
          delta: opt.delta,
          gamma: opt.gamma,
          theta: opt.theta,
          vega: opt.vega,
        },
        openInterest: opt.openInterest,
      })),
    });
  } catch (error) {
    console.error('[API /market/options] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
