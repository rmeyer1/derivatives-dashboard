/**
 * Server-Sent Events (SSE) Streaming Endpoint
 * Provides real-time market data streaming for client consumption
 */

import { NextRequest } from 'next/server';
import { marketData, isValidConfig, Quote } from '@/lib/market-data';

// Track active SSE connections
const activeConnections = new Map<string, ReadableStreamDefaultController>();
let connectionCounter = 0;

/**
 * SSE Route Handler
 * Connects to Alpaca WebSocket or REST polling and streams data to client
 */
export async function GET(request: NextRequest) {
  // Check if market data is configured
  if (!isValidConfig()) {
    return new Response(
      JSON.stringify({ error: 'Market data provider not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const clientId = `${Date.now()}-${++connectionCounter}`;
  const symbols = request.nextUrl.searchParams.get('symbols')?.split(',').filter(Boolean) || [];

  console.log(`[SSE Stream ${clientId}] Starting stream for symbols:`, symbols);

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message immediately (synchronous)
      try {
        const initMessage = {
          type: 'connected',
          clientId,
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(`data: ${JSON.stringify(initMessage)}\n\n`);
        console.log(`[SSE Stream ${clientId}] Connection message sent`);
      } catch (e) {
        console.error(`[SSE Stream ${clientId}] Failed to send connection message:`, e);
      }

      // Store controller for later message dispatch
      activeConnections.set(clientId, controller);

      // Handle data streaming asynchronously
      const startStreaming = async () => {
        if (symbols.length === 0) {
          console.log(`[SSE Stream ${clientId}] No symbols requested`);
          return;
        }

        try {
          // Send initial quotes immediately
          console.log(`[SSE Stream ${clientId}] Fetching initial quotes for ${symbols.length} symbols...`);
          const initialQuotes = await marketData.getQuotes(symbols);
          console.log(`[SSE Stream ${clientId}] Got ${initialQuotes.length} initial quotes`);

          for (const quote of initialQuotes) {
            const message = {
              type: 'quote',
              data: quote,
              timestamp: new Date().toISOString(),
            };
            try {
              controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
              console.log(`[SSE Stream ${clientId}] Sent quote: ${quote.symbol} @ ${quote.lastPrice || quote.bidPrice}`);
            } catch (error) {
              console.error(`[SSE Stream ${clientId}] Failed to enqueue quote:`, error);
              break;
            }
          }

          // Subscribe for real-time updates via REST polling (since WebSocket fallback)
          console.log(`[SSE Stream ${clientId}] Subscribing for real-time updates...`);
          marketData.subscribeQuotes(symbols, (quote: Quote) => {
            const message = {
              type: 'quote',
              data: quote,
              timestamp: new Date().toISOString(),
            };

            try {
              controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
              console.log(`[SSE Stream ${clientId}] Real-time quote: ${quote.symbol} @ ${quote.lastPrice || quote.bidPrice}`);
            } catch (error) {
              // Client disconnected
              console.log(`[SSE Stream ${clientId}] Client disconnected during streaming`);
              activeConnections.delete(clientId);
            }
          });

          console.log(`[SSE Stream ${clientId}] Subscription active`);
        } catch (error) {
          console.error(`[SSE Stream ${clientId}] Error:`, error);
          const errorMessage = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          try {
            controller.enqueue(`data: ${JSON.stringify(errorMessage)}\n\n`);
          } catch (e) {
            // Controller already closed
          }
        }
      };

      // Start streaming after connection is established
      startStreaming().catch(err => {
        console.error(`[SSE Stream ${clientId}] Fatal error:`, err);
      });

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
        } catch {
          clearInterval(heartbeat);
          activeConnections.delete(clientId);
          try {
            marketData.unsubscribe(symbols);
          } catch (e) {
            // Already unsubscribed
          }
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        activeConnections.delete(clientId);
        console.log(`[SSE Stream ${clientId}] Client aborted connection`);
        try {
          marketData.unsubscribe(symbols);
        } catch (e) {
          // Already unsubscribed
        }
      });
    },
    cancel() {
      // Cleanup on stream cancellation
      activeConnections.delete(clientId);
      console.log(`[SSE Stream ${clientId}] Stream cancelled`);
      try {
        marketData.unsubscribe(symbols);
      } catch (e) {
        // Already unsubscribed
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * POST handler for WebSocket-style messaging over HTTP
 */
export async function POST(request: NextRequest) {
  if (!isValidConfig()) {
    return new Response(
      JSON.stringify({ error: 'Market data provider not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { action, symbols } = body;

    if (!action || !symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: action and symbols array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'subscribe': {
        marketData.subscribeQuotes(symbols, (quote: Quote) => {
          const message = {
            type: 'quote',
            data: quote,
            timestamp: new Date().toISOString(),
          };

          const connections = Array.from(activeConnections.entries());
          for (const [connId, controller] of connections) {
            try {
              controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
            } catch {
              activeConnections.delete(connId);
            }
          }
        });

        return new Response(
          JSON.stringify({
            success: true,
            action: 'subscribe',
            symbols: symbols.map((s: string) => s.toUpperCase()),
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      case 'unsubscribe': {
        marketData.unsubscribe(symbols);

        return new Response(
          JSON.stringify({
            success: true,
            action: 'unsubscribe',
            symbols: symbols.map((s: string) => s.toUpperCase()),
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[SSE Stream] POST error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
