import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig, AlpacaProvider, Quote } from '@/lib/market-data';

/**
 * POST /api/market/quotes
 * Get quotes for multiple symbols
 * 
 * Body: {
 *   symbols: string[],           // Required - Array of stock symbols
 *   useWebSocket?: boolean,      // Optional - Subscribe to WebSocket updates
 *   stream?: boolean             // Optional - Use SSE streaming (serverless compatible)
 * }
 */
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
    const useWebSocket = body.useWebSocket === true;
    const stream = body.stream === true;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'symbols array required' },
        { status: 400 }
      );
    }

    // Validate symbol count
    if (symbols.length > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 symbols per request (Alpaca Basic tier limit)' },
        { status: 400 }
      );
    }

    const upperSymbols = symbols.map(s => s.toUpperCase().trim());

    // Handle SSE streaming request
    if (stream) {
      return handleStreaming(upperSymbols);
    }

    // Fetch quotes via REST
    const quotes = await marketData.getQuotes(upperSymbols);

    // Optionally subscribe to WebSocket for future updates
    if (useWebSocket && marketData instanceof AlpacaProvider) {
      // Get provider-specific info
      const provider = marketData as AlpacaProvider;
      
      // Subscribe to real-time updates
      provider.subscribeQuotes(upperSymbols, (quote: Quote) => {
        // In a real implementation, this would dispatch to connected clients
        // via your chosen real-time method (WebSocket, SSE, or polling)
        console.log('[Quotes API] Real-time update:', quote.symbol, quote.bidPrice, quote.askPrice);
      });
    }

    return NextResponse.json({
      quotes,
      count: quotes.length,
      streaming: useWebSocket,
      websocketActive: marketData instanceof AlpacaProvider 
        ? (marketData as AlpacaProvider).isWebSocketActive() 
        : false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Quotes API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/market/quotes?symbol=SPY
 * Get quote for a single symbol
 * 
 * Query params:
 *   symbol: string - Stock symbol (required)
 *   stream: boolean - Enable SSE streaming (optional)
 */
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
    const stream = searchParams.get('stream') === 'true';

    if (!symbol) {
      return NextResponse.json(
        { error: 'symbol parameter required' },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase().trim();

    // Handle streaming request
    if (stream) {
      return handleStreaming([upperSymbol]);
    }

    const quote = await marketData.getQuote(upperSymbol);

    return NextResponse.json({
      quote,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Quotes API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}

/**
 * Handle Server-Sent Events streaming
 */
function handleStreaming(symbols: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      // Send initial message
      const initData = {
        type: 'stream-start',
        symbols,
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(`data: ${JSON.stringify(initData)}\n\n`);

      // Subscribe to updates
      marketData.subscribeQuotes(symbols, (quote: Quote) => {
        const data = {
          type: 'quote',
          data: quote,
          timestamp: new Date().toISOString(),
        };
        
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Client disconnected
          marketData.unsubscribe([quote.symbol]);
        }
      });

      // Send heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } catch {
          clearInterval(heartbeat);
          marketData.unsubscribe(symbols);
        }
      }, 30000);
    },
    cancel() {
      marketData.unsubscribe(symbols);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
