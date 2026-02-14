import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig } from '@/lib/market-data';
import sqlite3 from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data/market_data.db';

interface MarketContextData {
  summary: {
    vixLevel: number;
    vixTrend: 'rising' | 'falling' | 'stable';
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    ivEnvironment: 'high' | 'low' | 'normal';
    lastUpdated: string;
  };
  positions: {
    totalPositions: number;
    highIVPositions: number;
    lowIVPositions: number;
    earningsApproaching: number;
    itmPositions: number;
  };
  ivRanks: Array<{
    ticker: string;
    ivRank: number;
    currentIV: number;
    suggestion: string;
  }>;
  earnings: Array<{
    ticker: string;
    daysToEarnings: number;
    earningsTime: string;
    risk: 'high' | 'medium' | 'low';
    action: string;
  }>;
  macro: {
    vix: {
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
    };
    sectors: Array<{
      symbol: string;
      name: string;
      changePercent: number;
    }>;
  };
  suggestions: Array<{
    id: string;
    ticker: string;
    type: string;
    confidence: string;
    message: string;
  }>;
}

function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

/**
 * GET /api/market/context
 * Get comprehensive market context data for the panel
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    const { searchParams } = new URL(request.url);
    const positionsOnly = searchParams.get('positions') === 'true';
    
    // Get position tickers
    const positionRows = db.prepare(`
      SELECT DISTINCT ticker, strategy, short_strike, 
             (SELECT close FROM daily_prices WHERE ticker = positions.ticker ORDER BY date DESC LIMIT 1) as stock_price
      FROM positions 
      WHERE status = 'open'
    `).all() as { ticker: string; strategy: string; short_strike: number; stock_price: number | null }[];
    
    const positionTickers = positionRows.map(r => r.ticker);
    const totalPositions = positionRows.length;
    
    // Get ITM positions
    const itmPositions = positionRows.filter(row => {
      if (!row.stock_price) return false;
      if (row.strategy.includes('Put')) {
        return row.stock_price < row.short_strike;
      }
      if (row.strategy.includes('Call')) {
        return row.stock_price > row.short_strike;
      }
      return false;
    }).length;
    
    // Get IV ranks for position tickers
    const ivRows = db.prepare(`
      SELECT symbol, iv_value, iv_rank_52w
      FROM iv_history
      WHERE symbol IN (${positionTickers.map(() => '?').join(',') || "''"})
    `).all(...positionTickers) as { symbol: string; iv_value: number; iv_rank_52w: number | null }[];
    
    const ivData = new Map<string, { iv: number; rank: number }>();
    for (const row of ivRows) {
      ivData.set(row.symbol, { iv: row.iv_value, rank: row.iv_rank_52w || 50 });
    }
    
    // Count high/low IV positions
    let highIVPositions = 0;
    let lowIVPositions = 0;
    for (const [_, data] of ivData) {
      if (data.rank >= 70) highIVPositions++;
      if (data.rank <= 30) lowIVPositions++;
    }
    
    // Get upcoming earnings for positions
    const earningsRows = db.prepare(`
      SELECT symbol, report_date, report_time,
             CAST((julianday(report_date) - julianday('now')) AS INTEGER) as days_to_earnings
      FROM earnings_cache
      WHERE symbol IN (${positionTickers.map(() => '?').join(',') || "''"})
        AND report_date >= DATE('now')
      ORDER BY report_date
    `).all(...positionTickers) as { 
      symbol: string; 
      report_date: string; 
      report_time: string;
      days_to_earnings: number;
    }[];
    
    const earningsApproaching = earningsRows.filter(e => e.days_to_earnings <= 7).length;
    
    // Get VIX data
    let vixPrice = 18.50;
    let vixChange = -0.85;
    let vixChangePercent = -4.2;
    
    if (isValidConfig()) {
      try {
        const vixSnapshot = await marketData.getSnapshot('VIX');
        const quote = vixSnapshot.quote;
        vixPrice = quote.lastPrice || (quote.bidPrice + quote.askPrice) / 2;
        vixChange = -0.85; // Would calculate from previous close
        vixChangePercent = -4.2;
      } catch {
        // Use defaults
      }
    }
    
    // Determine market environment
    const vixTrend = vixChange > 0.5 ? 'rising' : vixChange < -0.5 ? 'falling' : 'stable';
    const ivEnvironment = vixPrice > 25 ? 'high' : vixPrice < 15 ? 'low' : 'normal';
    const marketSentiment = vixPrice < 20 && vixChange < 0 ? 'bullish' : 
                           vixPrice > 25 ? 'bearish' : 'neutral';
    
    // Generate suggestions based on data
    const suggestions: MarketContextData['suggestions'] = [];
    
    // IV Rank suggestions
    for (const [ticker, data] of ivData) {
      if (data.rank >= 70) {
        suggestions.push({
          id: `${ticker}-highiv`,
          ticker,
          type: 'high_iv',
          confidence: 'high',
          message: `High IV Rank (${data.rank}) - Consider credit spreads on ${ticker}`,
        });
      } else if (data.rank <= 30) {
        suggestions.push({
          id: `${ticker}-lowiv`,
          ticker,
          type: 'low_iv',
          confidence: 'medium',
          message: `Low IV Rank (${data.rank}) - Premium collection unfavorable on ${ticker}`,
        });
      }
    }
    
    // Earnings warnings
    for (const e of earningsRows.filter(er => er.days_to_earnings <= 7)) {
      suggestions.push({
        id: `${e.symbol}-earnings`,
        ticker: e.symbol,
        type: 'earnings_warning',
        confidence: e.days_to_earnings <= 3 ? 'high' : 'medium',
        message: `${e.symbol} earnings in ${e.days_to_earnings} days (${e.report_time || 'TBD'})`,
      });
    }
    
    // ITM warnings
    if (itmPositions > 0) {
      suggestions.push({
        id: 'itm-warning',
        ticker: 'Portfolio',
        type: 'itm_alert',
        confidence: 'high',
        message: `${itmPositions} positions ITM - Review management plan`,
      });
    }
    
    // VIX environment suggestion
    if (vixPrice > 25) {
      suggestions.push({
        id: 'vix-high',
        ticker: 'Market',
        type: 'macro',
        confidence: 'medium',
        message: `High VIX (${vixPrice.toFixed(1)}) - Elevated volatility expected`,
      });
    } else if (vixPrice < 15) {
      suggestions.push({
        id: 'vix-low',
        ticker: 'Market',
        type: 'macro',
        confidence: 'low',
        message: `Low VIX (${vixPrice.toFixed(1)}) - Market complacency indicator`,
      });
    }
    
    // Sort suggestions by confidence
    const confOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => confOrder[a.confidence as 'high' | 'medium' | 'low'] - 
                            confOrder[b.confidence as 'high' | 'medium' | 'low']);
    
    const context: MarketContextData = {
      summary: {
        vixLevel: Math.round(vixPrice * 100) / 100,
        vixTrend,
        marketSentiment,
        ivEnvironment,
        lastUpdated: new Date().toISOString(),
      },
      positions: {
        totalPositions,
        highIVPositions,
        lowIVPositions,
        earningsApproaching,
        itmPositions,
      },
      ivRanks: positionTickers.map(t => {
        const data = ivData.get(t);
        const rank = data?.rank ?? 50;
        return {
          ticker: t,
          ivRank: rank,
          currentIV: data?.iv ?? 0.25,
          suggestion: rank >= 70 ? 'credit_spread' : 
                     rank <= 30 ? 'debit_spread' : 'neutral',
        };
      }),
      earnings: earningsRows.slice(0, 10).map(e => ({
        ticker: e.symbol,
        daysToEarnings: e.days_to_earnings,
        earningsTime: e.report_time === 'beforemkt' ? 'before' : 
                     e.report_time === 'aftermkt' ? 'after' : 'TBD',
        risk: e.days_to_earnings <= 3 ? 'high' : 
              e.days_to_earnings <= 7 ? 'medium' : 'low',
        action: e.days_to_earnings <= 3 ? 'Review ASAP' : 
                e.days_to_earnings <= 7 ? 'Monitor' : 'Watch',
      })),
      macro: {
        vix: {
          symbol: 'VIX',
          price: Math.round(vixPrice * 100) / 100,
          change: Math.round(vixChange * 100) / 100,
          changePercent: Math.round(vixChangePercent * 100) / 100,
        },
        sectors: [
          { symbol: 'XLK', name: 'Technology', changePercent: 0.75 },
          { symbol: 'XLF', name: 'Financials', changePercent: 0.42 },
          { symbol: 'XLE', name: 'Energy', changePercent: -0.28 },
          { symbol: 'XLV', name: 'Healthcare', changePercent: 0.15 },
        ],
      },
      suggestions: suggestions.slice(0, 8),
    };
    
    return NextResponse.json({
      data: context,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[MarketContext] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market context' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}
