/**
 * Alpaca WebSocket Manager
 * Handles real-time market data streaming for stocks and options
 */

import { EventEmitter } from 'events';

// WebSocket URLs for different feeds
const WS_URLS = {
  iex: 'wss://stream.data.alpaca.markets/v2/iex',      // Free tier - stocks
  sip: 'wss://stream.data.alpaca.markets/v2/sip',      // Paid - full stock market
  opra: 'wss://stream.data.alpaca.markets/v1beta1/opra', // Options (paid)
};

// Message types from Alpaca
export interface AlpacaWsQuote {
  T: 'q';              // Message type
  S: string;           // Symbol
  bp: number;          // Bid price
  bs: number;          // Bid size
  ap: number;          // Ask price
  as: number;          // Ask size
  t: string;           // Timestamp
  c?: string[];        // Conditions
  z?: string;          // Tape
}

export interface AlpacaWsTrade {
  T: 't';
  S: string;
  p: number;           // Price
  s: number;           // Size
  t: string;
  x: string;           // Exchange
  c?: string[];
  z?: string;
}

export interface AlpacaWsBar {
  T: 'b';
  S: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: string;
  n?: number;
  vw?: number;
}

export interface AlpacaWsError {
  T: 'error';
  code: number;
  msg: string;
}

export interface AlpacaWsSuccess {
  T: 'success';
  msg: string;
}

export type AlpacaWsMessage = 
  | AlpacaWsQuote 
  | AlpacaWsTrade 
  | AlpacaWsBar 
  | AlpacaWsError 
  | AlpacaWsSuccess;

// Subscription message
interface SubscribeMessage {
  action: 'subscribe' | 'unsubscribe';
  quotes?: string[];
  trades?: string[];
  bars?: string[];
}

// Auth message (for options feed)
interface AuthMessage {
  action: 'auth';
  key: string;
  secret: string;
}

export interface WebSocketConfig {
  apiKey: string;
  apiSecret: string;
  feed: 'iex' | 'sip' | 'opra';
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface QuoteHandler {
  (quote: AlpacaWsQuote): void;
}

export interface TradeHandler {
  (trade: AlpacaWsTrade): void;
}

export class AlpacaWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;
  private isAuthenticated = false;
  
  // Subscription state
  private subscribedQuotes = new Set<string>();
  private subscribedTrades = new Set<string>();
  private subscribedBars = new Set<string>();
  private pendingSubscriptions: SubscribeMessage[] = [];
  
  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };
  }
  
  /**
   * Connect to Alpaca WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    
    this.isIntentionallyClosed = false;
    const wsUrl = WS_URLS[this.config.feed];
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('[AlpacaWS] Connected to', wsUrl);
          this.reconnectAttempts = 0;
          this.emit('connected');
          
          // For options feed, send auth message
          if (this.config.feed === 'opra') {
            this.authenticate().then(() => {
              this.processPendingSubscriptions();
              resolve();
            }).catch(reject);
          } else {
            // IEX/SIP use header auth, no need for auth message
            this.isAuthenticated = true;
            this.processPendingSubscriptions();
            resolve();
          }
          
          this.startHeartbeat();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          console.error('[AlpacaWS] WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('[AlpacaWS] Disconnected');
          this.stopHeartbeat();
          this.isAuthenticated = false;
          this.emit('disconnected');
          
          if (!this.isIntentionallyClosed) {
            this.scheduleReconnect();
          }
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Authenticate with Alpaca (required for options feed)
   */
  private authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const authMsg: AuthMessage = {
        action: 'auth',
        key: this.config.apiKey,
        secret: this.config.apiSecret,
      };
      
      // Set up one-time listener for auth response
      const authHandler = (message: AlpacaWsMessage) => {
        if (message.T === 'success') {
          console.log('[AlpacaWS] Authenticated:', message.msg);
          this.isAuthenticated = true;
          this.removeListener('message', authHandler);
          resolve();
        } else if (message.T === 'error') {
          this.removeListener('message', authHandler);
          reject(new Error(`Auth failed: ${(message as AlpacaWsError).msg}`));
        }
      };
      
      this.on('message', authHandler);
      
      // Send auth message
      this.ws.send(JSON.stringify(authMsg));
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isAuthenticated) {
          this.removeListener('message', authHandler);
          reject(new Error('Authentication timeout'));
        }
      }, 10000);
    });
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string | ArrayBuffer | Buffer): void {
    try {
      // Options feed uses msgpack, but we'll handle JSON for now
      // msgpack decoding would require additional library
      let messages: AlpacaWsMessage[];
      
      if (typeof data === 'string') {
        // JSON parsing for stocks feed
        const parsed = JSON.parse(data);
        messages = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // Buffer/ArrayBuffer - would need msgpack decode for options
        // For now, convert to string as fallback
        messages = [JSON.parse(data.toString())];
      }
      
      for (const message of messages) {
        this.emit('message', message);
        
        switch (message.T) {
          case 'q':
            this.emit('quote', message as AlpacaWsQuote);
            break;
          case 't':
            this.emit('trade', message as AlpacaWsTrade);
            break;
          case 'b':
            this.emit('bar', message as AlpacaWsBar);
            break;
          case 'error':
            console.error('[AlpacaWS] Error:', (message as AlpacaWsError).msg);
            this.emit('error', message);
            break;
          case 'success':
            console.log('[AlpacaWS] Success:', (message as AlpacaWsSuccess).msg);
            break;
        }
      }
    } catch (error) {
      console.error('[AlpacaWS] Failed to parse message:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Subscribe to quotes for symbols
   */
  subscribeQuotes(symbols: string[]): void {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    for (const sym of upperSymbols) {
      this.subscribedQuotes.add(sym);
    }
    
    if (this.isConnected() && this.isAuthenticated) {
      this.sendSubscription({
        action: 'subscribe',
        quotes: upperSymbols,
      });
    } else {
      // Queue for when connected
      this.pendingSubscriptions.push({
        action: 'subscribe',
        quotes: upperSymbols,
      });
    }
  }
  
  /**
   * Subscribe to trades for symbols
   */
  subscribeTrades(symbols: string[]): void {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    for (const sym of upperSymbols) {
      this.subscribedTrades.add(sym);
    }
    
    if (this.isConnected() && this.isAuthenticated) {
      this.sendSubscription({
        action: 'subscribe',
        trades: upperSymbols,
      });
    } else {
      this.pendingSubscriptions.push({
        action: 'subscribe',
        trades: upperSymbols,
      });
    }
  }
  
  /**
   * Subscribe to minute bars for symbols
   */
  subscribeBars(symbols: string[]): void {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    for (const sym of upperSymbols) {
      this.subscribedBars.add(sym);
    }
    
    if (this.isConnected() && this.isAuthenticated) {
      this.sendSubscription({
        action: 'subscribe',
        bars: upperSymbols,
      });
    } else {
      this.pendingSubscriptions.push({
        action: 'subscribe',
        bars: upperSymbols,
      });
    }
  }
  
  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[]): void {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    
    for (const sym of upperSymbols) {
      this.subscribedQuotes.delete(sym);
      this.subscribedTrades.delete(sym);
      this.subscribedBars.delete(sym);
    }
    
    if (this.isConnected() && this.isAuthenticated) {
      this.sendSubscription({
        action: 'unsubscribe',
        quotes: upperSymbols,
        trades: upperSymbols,
        bars: upperSymbols,
      });
    }
  }
  
  /**
   * Unsubscribe from all symbols
   */
  unsubscribeAll(): void {
    const allQuotes = Array.from(this.subscribedQuotes);
    const allTrades = Array.from(this.subscribedTrades);
    const allBars = Array.from(this.subscribedBars);
    
    this.subscribedQuotes.clear();
    this.subscribedTrades.clear();
    this.subscribedBars.clear();
    
    if (this.isConnected() && this.isAuthenticated) {
      if (allQuotes.length > 0 || allTrades.length > 0 || allBars.length > 0) {
        this.sendSubscription({
          action: 'unsubscribe',
          quotes: allQuotes.length > 0 ? allQuotes : undefined,
          trades: allTrades.length > 0 ? allTrades : undefined,
          bars: allBars.length > 0 ? allBars : undefined,
        });
      }
    }
  }
  
  /**
   * Send subscription message
   */
  private sendSubscription(msg: SubscribeMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Filter out empty arrays
    const cleanMsg: SubscribeMessage = { action: msg.action };
    if (msg.quotes && msg.quotes.length > 0) cleanMsg.quotes = msg.quotes;
    if (msg.trades && msg.trades.length > 0) cleanMsg.trades = msg.trades;
    if (msg.bars && msg.bars.length > 0) cleanMsg.bars = msg.bars;
    
    if (cleanMsg.quotes || cleanMsg.trades || cleanMsg.bars) {
      this.ws.send(JSON.stringify(cleanMsg));
      console.log('[AlpacaWS] Subscription update:', cleanMsg);
    }
  }
  
  /**
   * Process any pending subscriptions after connection
   */
  private processPendingSubscriptions(): void {
    // Combine all pending subscriptions
    const allQuotes = new Set<string>();
    const allTrades = new Set<string>();
    const allBars = new Set<string>();
    
    for (const pending of this.pendingSubscriptions) {
      pending.quotes?.forEach(s => allQuotes.add(s));
      pending.trades?.forEach(s => allTrades.add(s));
      pending.bars?.forEach(s => allBars.add(s));
    }
    
    this.pendingSubscriptions = [];
    
    // Send combined subscription
    const msg: SubscribeMessage = { action: 'subscribe' };
    if (allQuotes.size > 0) msg.quotes = Array.from(allQuotes);
    if (allTrades.size > 0) msg.trades = Array.from(allTrades);
    if (allBars.size > 0) msg.bars = Array.from(allBars);
    
    if (msg.quotes || msg.trades || msg.bars) {
      this.sendSubscription(msg);
    }
  }
  
  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopReconnect();
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isAuthenticated = false;
    this.subscribedQuotes.clear();
    this.subscribedTrades.clear();
    this.subscribedBars.clear();
    this.pendingSubscriptions = [];
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * Check if authenticated
   */
  isAuth(): boolean {
    return this.isAuthenticated;
  }
  
  /**
   * Get current subscriptions
   */
  getSubscriptions(): {
    quotes: string[];
    trades: string[];
    bars: string[];
  } {
    return {
      quotes: Array.from(this.subscribedQuotes),
      trades: Array.from(this.subscribedTrades),
      bars: Array.from(this.subscribedBars),
    };
  }
  
  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscribedQuotes.size + 
           this.subscribedTrades.size + 
           this.subscribedBars.size;
  }
  
  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error('[AlpacaWS] Max reconnection attempts reached');
      this.emit('maxReconnectReached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval || 5000;
    
    console.log(`[AlpacaWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[AlpacaWS] Reconnection failed:', error);
      });
    }, delay);
  }
  
  /**
   * Stop reconnection attempts
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send a simple ping - Alpaca doesn't require specific heartbeat
        // but this helps detect dead connections
        this.ws.send(JSON.stringify({ action: 'listen' }));
      }
    }, this.config.heartbeatInterval || 30000);
  }
  
  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export default AlpacaWebSocketManager;
