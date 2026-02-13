/**
 * Subscription Manager
 * Tracks active subscriptions with limits and priority queue
 * Handles validation of symbol formats (OCC for options)
 */

export interface SubscriptionLimits {
  maxStocks: number;
  maxOptions: number;
}

export interface SubscriptionItem {
  symbol: string;
  type: 'stock' | 'option';
  priority: number; // Higher = more important
  timestamp: number;
  callback: QuoteUpdateHandler;
}

export interface QuoteUpdate {
  symbol: string;
  type: 'stock' | 'option';
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: string;
}

export type QuoteUpdateHandler = (update: QuoteUpdate) => void;

export interface SubscriptionError {
  code: 'LIMIT_EXCEEDED' | 'INVALID_SYMBOL' | 'ALREADY_SUBSCRIBED' | 'NOT_SUBSCRIBED';
  message: string;
  symbol?: string;
}

export class SubscriptionManager {
  private limits: SubscriptionLimits;
  private subscriptions = new Map<string, SubscriptionItem>();
  private priorityQueue: SubscriptionItem[] = [];
  private handlers = new Map<string, Set<QuoteUpdateHandler>>();
  
  constructor(limits: SubscriptionLimits) {
    this.limits = limits;
  }
  
  /**
   * Subscribe to stock symbols
   * @returns Array of successfully subscribed symbols
   */
  subscribeStocks(symbols: string[], callback: QuoteUpdateHandler, priority: number = 0): {
    subscribed: string[];
    errors: SubscriptionError[];
  } {
    const results: {
      subscribed: string[];
      errors: SubscriptionError[];
    } = {
      subscribed: [],
      errors: [],
    };
    
    const upperSymbols = symbols.map(s => s.toUpperCase().trim()).filter(s => s.length > 0);
    
    for (const symbol of upperSymbols) {
      // Validate symbol format (basic validation for stocks)
      if (!this.isValidStockSymbol(symbol)) {
        results.errors.push({
          code: 'INVALID_SYMBOL',
          message: `Invalid stock symbol: ${symbol}`,
          symbol,
        });
        continue;
      }
      
      const key = `stock:${symbol}`;
      
      // Check if already subscribed
      if (this.subscriptions.has(key)) {
        // Add additional handler
        if (!this.handlers.has(key)) {
          this.handlers.set(key, new Set());
        }
        this.handlers.get(key)!.add(callback);
        results.subscribed.push(symbol);
        continue;
      }
      
      // Check stock limit
      const stockCount = this.getStockCount();
      if (stockCount >= this.limits.maxStocks) {
        // Try to make room by removing lowest priority stock
        const evicted = this.evictLowestPriorityStock();
        if (!evicted) {
          // Add to priority queue
          this.priorityQueue.push({
            symbol,
            type: 'stock',
            priority,
            timestamp: Date.now(),
            callback,
          });
          this.priorityQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
          
          results.errors.push({
            code: 'LIMIT_EXCEEDED',
            message: `Stock subscription limit (${this.limits.maxStocks}) reached. ${symbol} queued with priority ${priority}.`,
            symbol,
          });
          continue;
        }
      }
      
      // Add subscription
      const item: SubscriptionItem = {
        symbol,
        type: 'stock',
        priority,
        timestamp: Date.now(),
        callback,
      };
      
      this.subscriptions.set(key, item);
      this.handlers.set(key, new Set([callback]));
      results.subscribed.push(symbol);
    }
    
    return results;
  }
  
  /**
   * Subscribe to option symbols (OCC format)
   * @returns Array of successfully subscribed symbols
   */
  subscribeOptions(symbols: string[], callback: QuoteUpdateHandler, priority: number = 0): {
    subscribed: string[];
    errors: SubscriptionError[];
  } {
    const results: {
      subscribed: string[];
      errors: SubscriptionError[];
    } = {
      subscribed: [],
      errors: [],
    };
    
    for (const symbol of symbols) {
      const normalized = this.normalizeOCCSymbol(symbol);
      
      // Validate OCC format
      if (!this.isValidOCCSymbol(normalized)) {
        results.errors.push({
          code: 'INVALID_SYMBOL',
          message: `Invalid OCC option symbol: ${symbol}. Expected format: O:SPY251215C00580000`,
          symbol,
        });
        continue;
      }
      
      const key = `option:${normalized}`;
      
      // Check if already subscribed
      if (this.subscriptions.has(key)) {
        if (!this.handlers.has(key)) {
          this.handlers.set(key, new Set());
        }
        this.handlers.get(key)!.add(callback);
        results.subscribed.push(normalized);
        continue;
      }
      
      // Check option limit
      const optionCount = this.getOptionCount();
      if (optionCount >= this.limits.maxOptions) {
        // Try to make room
        const evicted = this.evictLowestPriorityOption();
        if (!evicted) {
          this.priorityQueue.push({
            symbol: normalized,
            type: 'option',
            priority,
            timestamp: Date.now(),
            callback,
          });
          this.priorityQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
          
          results.errors.push({
            code: 'LIMIT_EXCEEDED',
            message: `Option subscription limit (${this.limits.maxOptions}) reached. ${normalized} queued.`,
            symbol: normalized,
          });
          continue;
        }
      }
      
      // Add subscription
      const item: SubscriptionItem = {
        symbol: normalized,
        type: 'option',
        priority,
        timestamp: Date.now(),
        callback,
      };
      
      this.subscriptions.set(key, item);
      this.handlers.set(key, new Set([callback]));
      results.subscribed.push(normalized);
    }
    
    return results;
  }
  
  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[]): {
    unsubscribed: string[];
    errors: SubscriptionError[];
  } {
    const results = {
      unsubscribed: [] as string[],
      errors: [] as SubscriptionError[],
    };
    
    for (const symbol of symbols) {
      const normalized = this.normalizeOCCSymbol(symbol);
      const upperSymbol = normalized.toUpperCase();
      
      // Try stock first, then option
      let key = `stock:${upperSymbol}`;
      if (!this.subscriptions.has(key)) {
        key = `option:${upperSymbol}`;
      }
      
      if (!this.subscriptions.has(key)) {
        results.errors.push({
          code: 'NOT_SUBSCRIBED',
          message: `Not subscribed to: ${symbol}`,
          symbol,
        });
        continue;
      }
      
      this.subscriptions.delete(key);
      this.handlers.delete(key);
      results.unsubscribed.push(upperSymbol);
      
      // Try to fulfill from priority queue
      this.processPriorityQueue();
    }
    
    return results;
  }
  
  /**
   * Unsubscribe from all symbols
   */
  unsubscribeAll(): string[] {
    const allSymbols = Array.from(this.subscriptions.keys()).map(key => {
      const item = this.subscriptions.get(key)!;
      return item.symbol;
    });
    
    this.subscriptions.clear();
    this.handlers.clear();
    this.priorityQueue = [];
    
    return allSymbols;
  }
  
  /**
   * Dispatch quote update to all handlers
   */
  dispatchUpdate(update: QuoteUpdate): void {
    const key = `${update.type}:${update.symbol}`;
    const handlers = this.handlers.get(key);
    
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(update);
        } catch (error) {
          console.error(`[SubscriptionManager] Handler error for ${key}:`, error);
        }
      }
    }
  }
  
  /**
   * Get all active subscriptions
   */
  getSubscriptions(): {
    stocks: string[];
    options: string[];
  } {
    const stocks: string[] = [];
    const options: string[] = [];
    
    for (const [key, item] of this.subscriptions) {
      if (item.type === 'stock') {
        stocks.push(item.symbol);
      } else {
        options.push(item.symbol);
      }
    }
    
    return { stocks, options };
  }
  
  /**
   * Get subscription count
   */
  getStockCount(): number {
    let count = 0;
    for (const item of this.subscriptions.values()) {
      if (item.type === 'stock') count++;
    }
    return count;
  }
  
  getOptionCount(): number {
    let count = 0;
    for (const item of this.subscriptions.values()) {
      if (item.type === 'option') count++;
    }
    return count;
  }
  
  /**
   * Check if symbol is subscribed
   */
  isSubscribed(symbol: string, type: 'stock' | 'option' = 'stock'): boolean {
    const key = `${type}:${symbol.toUpperCase()}`;
    return this.subscriptions.has(key);
  }
  
  /**
   * Get priority queue
   */
  getPriorityQueue(): SubscriptionItem[] {
    return [...this.priorityQueue];
  }
  
  /**
   * Update limits
   */
  setLimits(limits: Partial<SubscriptionLimits>): void {
    this.limits = { ...this.limits, ...limits };
    this.processPriorityQueue();
  }
  
  /**
   * Process priority queue after unsubscribe or limit increase
   */
  private processPriorityQueue(): void {
    const toProcess = [...this.priorityQueue];
    this.priorityQueue = [];
    
    for (const item of toProcess) {
      if (item.type === 'stock') {
        const stockCount = this.getStockCount();
        if (stockCount < this.limits.maxStocks) {
          this.subscriptions.set(`stock:${item.symbol}`, item);
          this.handlers.set(`stock:${item.symbol}`, new Set([item.callback]));
          console.log(`[SubscriptionManager] Fulfilled queued stock subscription: ${item.symbol}`);
        } else {
          this.priorityQueue.push(item);
        }
      } else {
        const optionCount = this.getOptionCount();
        if (optionCount < this.limits.maxOptions) {
          this.subscriptions.set(`option:${item.symbol}`, item);
          this.handlers.set(`option:${item.symbol}`, new Set([item.callback]));
          console.log(`[SubscriptionManager] Fulfilled queued option subscription: ${item.symbol}`);
        } else {
          this.priorityQueue.push(item);
        }
      }
    }
    
    // Re-sort
    this.priorityQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
  }
  
  /**
   * Evict lowest priority stock to make room
   */
  private evictLowestPriorityStock(): boolean {
    let lowest: SubscriptionItem | null = null;
    let lowestKey: string | null = null;
    
    for (const [key, item] of this.subscriptions) {
      if (item.type === 'stock') {
        if (!lowest || item.priority < lowest.priority || 
            (item.priority === lowest.priority && item.timestamp > lowest.timestamp)) {
          lowest = item;
          lowestKey = key;
        }
      }
    }
    
    if (lowestKey && lowest) {
      this.subscriptions.delete(lowestKey);
      this.handlers.delete(lowestKey);
      // Re-queue the evicted item with same priority
      this.priorityQueue.push(lowest);
      console.log(`[SubscriptionManager] Evicted stock subscription: ${lowest.symbol} (priority: ${lowest.priority})`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Evict lowest priority option to make room
   */
  private evictLowestPriorityOption(): boolean {
    let lowest: SubscriptionItem | null = null;
    let lowestKey: string | null = null;
    
    for (const [key, item] of this.subscriptions) {
      if (item.type === 'option') {
        if (!lowest || item.priority < lowest.priority || 
            (item.priority === lowest.priority && item.timestamp > lowest.timestamp)) {
          lowest = item;
          lowestKey = key;
        }
      }
    }
    
    if (lowestKey && lowest) {
      this.subscriptions.delete(lowestKey);
      this.handlers.delete(lowestKey);
      this.priorityQueue.push(lowest);
      console.log(`[SubscriptionManager] Evicted option subscription: ${lowest.symbol} (priority: ${lowest.priority})`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Validate stock symbol format
   */
  private isValidStockSymbol(symbol: string): boolean {
    // Basic validation - 1-6 uppercase letters/numbers
    return /^[A-Z]{1,6}$/.test(symbol);
  }
  
  /**
   * Validate OCC option symbol format
   * Format: O:SPY251215C00580000 (with O: prefix) or SPY251215C00580000 (without)
   */
  private isValidOCCSymbol(symbol: string): boolean {
    // Remove O: prefix for validation
    const clean = symbol.replace(/^O:/, '');
    
    // OCC format: Underlying(1-6 chars) + YY(2) + MM(2) + DD(2) + C/P(1) + Strike(8)
    // Example: AAPL240315C00172500
    return /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(clean);
  }
  
  /**
   * Normalize OCC symbol to include O: prefix
   */
  private normalizeOCCSymbol(symbol: string): string {
    const upper = symbol.toUpperCase().trim();
    if (upper.startsWith('O:')) {
      return upper;
    }
    return `O:${upper}`;
  }
}

/**
 * Helper function to convert internal format to OCC symbol
 * Example: toOCCSymbol('AAPL', '2024-03-15', 'call', 172.5) => 'O:AAPL240315C00172500'
 */
export function toOCCSymbol(
  ticker: string,
  expirationDate: string,
  optionType: 'call' | 'put',
  strike: number
): string {
  const cleanTicker = ticker.toUpperCase();
  
  // Parse expiration date
  const date = new Date(expirationDate);
  const year = date.getFullYear().toString().slice(-2); // Last 2 digits
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Format strike - multiply by 1000, pad to 8 digits
  const strikeCents = Math.round(strike * 1000);
  const strikeStr = strikeCents.toString().padStart(8, '0');
  
  // Option type code
  const typeCode = optionType === 'call' ? 'C' : 'P';
  
  return `O:${cleanTicker}${year}${month}${day}${typeCode}${strikeStr}`;
}

/**
 * Parse OCC symbol to components
 */
export function parseOCCSymbol(occSymbol: string): {
  ticker: string;
  expirationDate: string;
  optionType: 'call' | 'put';
  strike: number;
} | null {
  const clean = occSymbol.toUpperCase().trim().replace(/^O:/, '');
  
  const match = clean.match(/^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return null;
  
  const [, ticker, year, month, day, typeCode, strikeStr] = match;
  
  // Convert 2-digit year to 4-digit
  const fullYear = parseInt(year, 10) >= 50 ? `19${year}` : `20${year}`;
  const expirationDate = `${fullYear}-${month}-${day}`;
  
  const strike = parseInt(strikeStr, 10) / 1000;
  const optionType = typeCode === 'C' ? 'call' : 'put';
  
  return { ticker, expirationDate, optionType, strike };
}

export default SubscriptionManager;
