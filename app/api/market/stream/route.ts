/**
 * Server-Sent Events (SSE) Streaming Endpoint
 * Provides real-time market data streaming for client consumption
 * 
 * This endpoint acts as a bridge between:
 * - Alpaca WebSocket (server-side) 
 * - Client browser via Server-Sent Events
 * 
 * Useful for serverless deployments where direct WebSocket connections
 * from the client are not feasible.
 */

import { NextRequest } from 'next/server';
import { marketData, isValidConfig, Quote } from '@/lib/market-data';

// Track active SSE connections
const activeConnections = new Map<string, ReadableStreamDefaultController>();
let connectionCounter = 0;

/**
 * SSE Route Handler
 * Connects to Alpaca WebSocket and streams data to client
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
  const symbols = request.nextUrl.searchParams.get('symbols')?.split(',') || [];

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const initMessage = {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(`data: ${JSON.stringify(initMessage)}\n\n`);

      // Store controller for later message dispatch
      activeConnections.set(clientId, controller);

      // Subscribe to market data
      if (symbols.length > 0) {
        try {
          // Send initial quotes immediately
          const initialQuotes = await marketData.getQuotes(symbols);
          for (const quote of initialQuotes) {
            const message = {
              type: 'quote',
              data: quote,
              timestamp: new Date().toISOString(),
            };
            controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
          }

          // Subscribe for real-time updates
          marketData.subscribeQuotes(symbols, (quote: Quote) => {
            const message = {
              type: 'quote',
              data: quote,
              timestamp: new Date().toISOString(),
            };
            
            try {
              controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
            } catch (error) {
              // Client disconnected
              activeConnections.delete(clientId);
            }
          });
        } catch (error) {
          console.error('[SSE Stream] Subscription error:', error);
          const errorMessage = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          controller.enqueue(`data: ${JSON.stringify(errorMessage)}\n\n`);
        }
      }

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } catch {
          clearInterval(heartbeat);
          activeConnections.delete(clientId);
          marketData.unsubscribe(symbols);
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        activeConnections.delete(clientId);
        marketData.unsubscribe(symbols);
        console.log(`[SSE Stream] Client ${clientId} disconnected`);
      });
    },
    cancel() {
      // Cleanup on stream cancellation
      activeConnections.delete(clientId);
      marketData.unsubscribe(symbols);
      console.log(`[SSE Stream] Stream cancelled for client ${clientId}`);
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

/**
 * POST handler for WebSocket-style messaging over HTTP
 * Allows clients to subscribe/unsubscribe without reconnecting
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
          // Dispatch to all active SSE connections
          const message = {
            type: 'quote',
            data: quote,
            timestamp: new Date().toISOString(),
          };
          
          // Convert Map entries to array for iteration
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

/**
 * Get stream status
 */
export async function HEAD() {
  return new Response(null, {
    headers: {
      'X-Active-Connections': String(activeConnections.size),
      'X-Max-Connections': '100',
    },
  });
}
