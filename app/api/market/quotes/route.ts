import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig } from '@/lib/market-data';

export async function POST(request: NextRequest) {
  try {
    // Validate configuration
    if (!isValidConfig()) {
      return NextResponse.json(
        { error: 'Market data provider not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const symbols = body.symbols;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'symbols array required' },
        { status: 400 }
      );
    }

    // Validate symbol format
    if (symbols.length > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 symbols per request (Alpaca Basic tier limit)' },
        { status: 400 }
      );
    }

    // Fetch quotes
    const quotes = await marketData.getQuotes(symbols);

    return NextResponse.json({
      quotes,
      count: quotes.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}

// Also support GET for single symbol
export async function GET(request: NextRequest) {
  try {
    if (!isValidConfig()) {
      return NextResponse.json(
        { error: 'Market data provider not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'symbol parameter required' },
        { status: 400 }
      );
    }

    const quote = await marketData.getQuote(symbol);

    return NextResponse.json({
      quote,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}