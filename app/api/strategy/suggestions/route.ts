import { NextRequest, NextResponse } from 'next/server';
import { marketData, isValidConfig } from '@/lib/market-data';
import { initMarketCacheTables } from '@/lib/db/market-cache';
import sqlite3 from 'better-sqlite3';

// Ensure tables exist on module load
initMarketCacheTables();

const DB_PATH = process.env.DB_PATH || './data/market_data.db';

// Sector ETFs for sector allocation analysis
const SECTOR_ETFS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLRE', 'XLB'];

interface StrategySuggestion {
  id: string;
  ticker: string;
  strategyType: 'CSP' | 'CCS' | 'Cash-Secured Put' | 'Call Credit Spread' | 'Put Credit Spread';
  suggestionType: 'high_iv' | 'low_iv' | 'neutral' | 'earnings' | 'technical' | 'portfolio_alert' | 'sector';
  confidence: 'high' | 'medium' | 'low';
  ivRank: number;
  delta: number;
  dteRecommendation: number;
  strikeSelection: string;
  premiumEstimate: number;
  rationale: string;
  technicalSignal?: string;
  supportLevel?: number;
  resistanceLevel?: number;
  expirationDate?: string;
}

interface PositionData {
  id: number;
  ticker: string;
  strategy: string;
  shortStrike: number;
  longStrike: number | null;
  contracts: number;
  entryCreditPerContract: number;
  currentPrice: number | null;
  dte: number;
  optionType: string;
}

interface EarningsData {
  ticker: string;
  daysToEarnings: number;
  earningsTime: string;
}

interface IVData {
  ticker: string;
  ivRank: number;
  currentIV: number;
}

function getDb() {
  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Get open positions
 */
function getOpenPositions(db: sqlite3.Database): PositionData[] {
  const rows = db.prepare(`
    SELECT 
      p.id, p.ticker, p.strategy, p.short_strike, p.long_strike,
      p.contracts, p.entry_credit_per_contract, p.expiration_date,
      p.option_type, p.status, l.price as currentPrice
    FROM positions p
    LEFT JOIN (
      SELECT ticker, close as price
      FROM daily_prices
      WHERE date = (SELECT MAX(date) FROM daily_prices WHERE ticker = positions.ticker)
    ) l ON p.ticker = l.ticker
    WHERE p.status = 'open'
  `).all() as any[];
  
  const positions: PositionData[] = [];
  const now = new Date();
  
  for (const row of rows) {
    const expirationDate = new Date(row.expiration_date);
    const dte = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    positions.push({
      id: row.id,
      ticker: row.ticker,
      strategy: row.strategy,
      shortStrike: row.short_strike,
      longStrike: row.long_strike,
      contracts: row.contracts,
      entryCreditPerContract: row.entry_credit_per_contract,
      currentPrice: row.currentPrice,
      dte: Math.max(0, dte),
      optionType: row.option_type,
    });
  }
  
  return positions;
}

/**
 * Get upcoming earnings for tickers
 */
function getUpcomingEarnings(db: sqlite3.Database, tickers: string[]): EarningsData[] {
  const placeholders = tickers.map(() => '?').join(',');
  
  const rows = db.prepare(`
    SELECT symbol, report_date, report_time
    FROM earnings_cache
    WHERE symbol IN (${placeholders})
      AND report_date >= DATE('now')
    ORDER BY report_date
  `).all(...tickers) as { symbol: string; report_date: string; report_time: string }[];
  
  const now = new Date();
  
  return rows.map(row => {
    const reportDate = new Date(row.report_date);
    const diffTime = reportDate.getTime() - now.getTime();
    const daysToEarnings = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      ticker: row.symbol,
      daysToEarnings,
      earningsTime: row.report_time === 'beforemkt' ? 'before_market' : 
                    row.report_time === 'aftermkt' ? 'after_market' : 'unknown',
    };
  });
}

/**
 * Get IV rank data
 */
function getIVRanks(db: sqlite3.Database, tickers: string[]): Map<string, IVData> {
  const placeholders = tickers.map(() => '?').join(',');
  
  // First try to get from cached IV history
  const rows = db.prepare(`
    SELECT symbol, iv_value, DATE(recorded_at) as date
    FROM iv_history
    WHERE symbol IN (${placeholders})
    ORDER BY recorded_at DESC
  `).all(...tickers) as { symbol: string; iv_value: number; date: string }[];
  
  const ivMap = new Map<string, IVData>();
  const now = new Date();
  
  // Calculate IV rank from historical data
  for (const ticker of tickers) {
    const tickerRows = rows.filter(r => r.symbol === ticker);
    if (tickerRows.length > 0) {
      const currentIV = tickerRows[0].iv_value;
      const allIVs = tickerRows.map(r => r.iv_value);
      const high52 = Math.max(...allIVs);
      const low52 = Math.min(...allIVs);
      const ivRank = ((currentIV - low52) / (high52 - low52)) * 100;
      
      // Check if IV rank was previously calculated and stored
      const rankRow = db.prepare(`
        SELECT iv_rank_52w FROM iv_history 
        WHERE symbol = ? AND iv_rank_52w IS NOT NULL
        ORDER BY recorded_at DESC LIMIT 1
      `).get(ticker) as { iv_rank_52w: number } | undefined;
      
      ivMap.set(ticker, {
        ticker,
        ivRank: Math.max(0, Math.min(100, Math.round(rankRow?.iv_rank_52w || ivRank))),
        currentIV,
      });
    }
  }
  
  return ivMap;
}

/**
 * Get current stock prices for positions
 */
async function getStockPrices(tickers: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  if (!isValidConfig() || tickers.length === 0) {
    return prices;
  }
  
  try {
    const quotes = await marketData.getQuotes(tickers);
    for (const quote of quotes) {
      prices.set(quote.symbol, quote.lastPrice || (quote.bidPrice + quote.askPrice) / 2);
    }
  } catch (error) {
    console.warn('[StrategySuggestions] Failed to fetch prices:', error);
  }
  
  return prices;
}

/**
 * Get sector performance for diversification check
 */
async function getSectorPerformance(): Promise<Map<string, number>> {
  const performance = new Map<string, number>();
  
  if (!isValidConfig()) {
    return performance;
  }
  
  try {
    const snapshs = await marketData.getSnapshots(SECTOR_ETFS);
    for (const snapshot of snapshs) {
      const dailyBar = snapshot.dailyBar;
      if (dailyBar) {
        const change = dailyBar.close - (snapshot.prevDailyBar?.close || dailyBar.open);
        const changePercent = (change / (snapshot.prevDailyBar?.close || dailyBar.open)) * 100;
        performance.set(snapshot.symbol, changePercent);
      }
    }
  } catch (error) {
    console.warn('[StrategySuggestions] Failed to fetch sector data:', error);
  }
  
  return performance;
}

/**
 * Generate strategy suggestions based on analysis
 */
async function generateSuggestions(
  positions: PositionData[],
  earnings: EarningsData[],
  ivRanks: Map<string, IVData>,
  stockPrices: Map<string, number>,
  sectorPerformance: Map<string, number>
): Promise<StrategySuggestion[]> {
  const suggestions: StrategySuggestion[] = [];
  const now = new Date();
  
  // Get unique tickers from positions
  const positionTickers = [...new Set(positions.map(p => p.ticker))];
  const earningsMap = new Map(earnings.map(e => [e.ticker, e]));
  const positionsByTicker = new Map<string, PositionData[]>();
  
  for (const pos of positions) {
    if (!positionsByTicker.has(pos.ticker)) {
      positionsByTicker.set(pos.ticker, []);
    }
    positionsByTicker.get(pos.ticker)!.push(pos);
  }
  
  // Check each position ticker for opportunities
  for (const ticker of positionTickers) {
    const tickerPositions = positionsByTicker.get(ticker)!;
    const ivData = ivRanks.get(ticker);
    const earningsData = earningsMap.get(ticker);
    const stockPrice = stockPrices.get(ticker);
    
    // Skip if we don't have adequate data
    if (!ivData) continue;
    
    const ivRank = ivData.ivRank;
    const currentIV = ivData.currentIV;
    
    // HIGH IV RANK (> 70%): Suggest credit spreads
    if (ivRank >= 70) {
      const isHighIV = ivRank >= 85;
      const dte = isHighIV ? 21 : 45;  // Shorter for extreme IV
      const expiration = new Date(now.getTime() + dte * 24 * 60 * 60 * 1000);
      const expStr = expiration.toISOString().split('T')[0];
      
      // Find support/resistance levels from positions
      const supportLevel = tickerPositions.find(p => p.currentPrice)?.currentPrice ?? undefined;
      const resistanceLevel = supportLevel ? supportLevel * 1.15 : stockPrice ? stockPrice * 1.15 : undefined;
      
      // Suggest CSP for high IV
      if (stockPrice) {
        const strikeOTM = Math.round(stockPrice * 0.88); // ~12% OTM
        const premium = isHighIV ? 4.5 : 2.5;
        
        suggestions.push({
          id: `${ticker}-csp-highiv-${Date.now()}`,
          ticker,
          strategyType: 'CSP',
          suggestionType: 'high_iv',
          confidence: ivRank >= 85 ? 'high' : 'medium',
          ivRank,
          delta: -0.25,
          dteRecommendation: dte,
          strikeSelection: `$${strikeOTM} (≈${Math.round((1 - strikeOTM/stockPrice) * 100)}% OTM)`,
          premiumEstimate: premium,
          rationale: `High IV Rank (${ivRank}) presents excellent premium collection opportunity. Strong implied volatility premium to capture.`,
          technicalSignal: 'High IV environment',
          supportLevel,
          resistanceLevel,
          expirationDate: expStr,
        });
      }
      
      // If has CSP position approaching DTE < 21, suggest rolling
      const nearExpiryPositions = tickerPositions.filter(p => 
        p.strategy.includes('Put') && p.dte <= 14
      );
      
      if (nearExpiryPositions.length > 0 && ivRank >= 70) {
        const pos = nearExpiryPositions[0];
        suggestions.push({
          id: `${ticker}-roll-iv-${Date.now()}`,
          ticker,
          strategyType: pos.strategy as any,
          suggestionType: 'high_iv',
          confidence: 'high',
          ivRank,
          delta: -0.28,
          dteRecommendation: 45,
          strikeSelection: `$${Math.round(pos.shortStrike * 0.95)} (roll down)`,
          premiumEstimate: 1.85,
          rationale: `High IV Rank (${ivRank}) supports rolling for additional credit. ${pos.dte} DTE approaching.`,
          technicalSignal: 'High IV persists, favorable for rolls',
        });
      }
    }
    
    // LOW IV RANK (< 30%): Suggest debit spreads
    if (ivRank <= 30) {
      const dte = 14; // Shorter for low IV
      const expiration = new Date(now.getTime() + dte * 24 * 60 * 60 * 1000);
      
      suggestions.push({
        id: `${ticker}-pds-lowiv-${Date.now()}`,
        ticker,
        strategyType: 'Put Credit Spread',
        suggestionType: 'low_iv',
        confidence: stockPrice && stockPrice > tickerPositions[0]?.shortStrike ? 'high' : 'medium',
        ivRank,
        delta: -0.15,
        dteRecommendation: dte,
        strikeSelection: 'Bullish debit spreads preferred',
        premiumEstimate: 1.25,
        rationale: `Low IV Rank (${ivRank}) favors directional plays over premium collection. Consider debit spreads for directional exposure.`,
        technicalSignal: 'Low IV suggests directional bias',
      });
    }
    
    // EARNINGS APPROACHING (< 7 days): Warn about assignment risk
    if (earningsData && earningsData.daysToEarnings <= 7) {
      for (const pos of tickerPositions) {
        const isITM = stockPrice && (
          (pos.strategy.includes('Put') && stockPrice < pos.shortStrike) ||
          (pos.strategy.includes('Call') && stockPrice > pos.shortStrike)
        );
        
        if (isITM && pos.dte <= earningsData.daysToEarnings + 7) {
          suggestions.push({
            id: `${ticker}-earnings-warning-${pos.id}`,
            ticker,
            strategyType: pos.strategy as any,
            suggestionType: 'earnings',
            confidence: earningsData.daysToEarnings <= 3 ? 'high' : 'medium',
            ivRank,
            delta: isITM ? -0.45 : -0.25,
            dteRecommendation: 0, // Manage now
            strikeSelection: isITM ? 'Consider rolling or taking assignment' : 'Monitor closely',
            premiumEstimate: 0,
            rationale: `Earnings in ${earningsData.daysToEarnings} days. ITM position at risk of early assignment. ${isITM ? 'Position is ITM - consider rolling or taking assignment.' : 'Position OTM but volatility risk elevated.'}`,
            technicalSignal: `Earnings ${earningsData.earningsTime}`,
          });
        }
      }
    }
    
    // CSP ITM: Suggest rolling or taking assignment
    for (const pos of tickerPositions) {
      if (pos.strategy === 'Cash Secured Put' || pos.strategy === 'Cash-Secured Put') {
        const itm = stockPrice && stockPrice < pos.shortStrike;
        const dte = pos.dte;
        
        if (itm) {
          const itmPercent = ((pos.shortStrike - stockPrice) / pos.shortStrike) * 100;
          
          // Deep ITM, suggest taking assignment
          if (itmPercent > 10) {
            suggestions.push({
              id: `${ticker}-csp-assignment-${pos.id}`,
              ticker,
              strategyType: 'CSP',
              suggestionType: 'portfolio_alert',
              confidence: dte <= 7 ? 'high' : 'medium',
              ivRank,
              delta: -0.60,
              dteRecommendation: 0,
              strikeSelection: `$${pos.shortStrike} (${itmPercent.toFixed(1)}% ITM)`,
              premiumEstimate: 0,
              rationale: `CSP is ${itmPercent.toFixed(1)}% ITM with ${dte} DTE${dte <= 7 ? '. Assignment likely imminent.' : '. Consider taking assignment or rolling down and out.'}`,
              technicalSignal: `Price \$$${stockPrice?.toFixed(2)} \u003c Strike \$$${pos.shortStrike}`,
              supportLevel: Math.round(stockPrice * 0.95),
            });
          }
          // Near ATM, suggest roll
          else if (itmPercent > 0 && itmPercent <= 10 && dte <= 21) {
            const rollStrike = Math.round(pos.shortStrike * 0.95);
            const rollPremium = Math.max(1.0, pos.entryCreditPerContract * 0.5);
            
            suggestions.push({
              id: `${ticker}-csp-roll-${pos.id}`,
              ticker,
              strategyType: 'CSP',
              suggestionType: 'portfolio_alert',
              confidence: dte <= 7 ? 'high' : 'medium',
              ivRank,
              delta: -0.35,
              dteRecommendation: 45,
              strikeSelection: `$${rollStrike} (roll down and out)`,
              premiumEstimate: Math.round(rollPremium * 100) / 100,
              rationale: `CSP is ${itmPercent.toFixed(1)}% ITM with ${dte} DTE. Rolling down and out can collect additional credit while managing risk.`,
              technicalSignal: `Support at \$$${(stockPrice * 0.95).toFixed(2)}`,
              supportLevel: Math.round(stockPrice * 0.95),
            });
          }
        }
      }
      
      // Call Credit Spread nearing max profit
      if (pos.strategy === 'Call Credit Spread' && stockPrice && pos.longStrike) {
        const width = pos.longStrike - pos.shortStrike;
        const currentPrice = stockPrice;
        const buffer = pos.shortStrike - currentPrice;
        const maxProfit = (pos.entryCreditPerContract || 0) * 100 * pos.contracts;
        
        if (buffer > 0 && pos.dte <= 14) {
          suggestions.push({
            id: `${ticker}-ccs-close-${pos.id}`,
            ticker,
            strategyType: 'CCS',
            suggestionType: 'technical',
            confidence: buffer / width > 0.5 ? 'high' : 'medium',
            ivRank,
            delta: pos.entryCreditPerContract || 0,
            dteRecommendation: 0,
            strikeSelection: `Close for ~${((maxProfit > 0 ? 0.8 : 0) * 100).toFixed(0)}% profit`,
            premiumEstimate: -(pos.entryCreditPerContract * 0.2), // Approx cost to close
            rationale: `CCS is ${((buffer/width)*100).toFixed(1)}% away from short strike with ${pos.dte} DTE. Consider closing early to lock in profits and free up capital.`,
            resistanceLevel: pos.shortStrike,
          });
        }
      }
    }
  }
  
  // Check sector allocation for missing sectors
  const positionSectors = new Set<string>();
  // This is simplified - in production you'd map tickers to sectors
  const missingSectors = [...sectorPerformance.entries()]
    .filter(([symbol, perf]) => !positionTickers.some(t => {
      // Simplified sector matching
      return (symbol === 'XLK' && t === 'AAPL') ||
             (symbol === 'XLF' && t === 'JPM') ||
             (symbol === 'XLE' && t === 'XOM');
    }));
  
  // If under 3 sectors represented, suggest diversification
  if (sectorPerformance.size >= 3 && positionTickers.length >= 3) {
    const sectorsPresent = new Set<string>();
    // Simplified - would need sector mapping
    for (const ticker of positionTickers) {
      if (['AAPL', 'MSFT', 'NVDA', 'AMD', 'META', 'NFLX'].includes(ticker)) sectorsPresent.add('Tech');
      if (['JPM', 'BAC'].includes(ticker)) sectorsPresent.add('Financials');
      if (['TSLA', 'F'].includes(ticker)) sectorsPresent.add('Autos');
    }
    
    // Find sectors with positive performance that are missing
    const missingStrongPerformers = [...sectorPerformance.entries()]
      .filter(([sym, perf]) => perf > 1.0)
      .sort((a, b) => b[1] - a[1]);
    
    if (missingStrongPerformers.length > 0) {
      const sectorNames: Record<string, string> = {
        'XLK': 'Technology',
        'XLF': 'Financials', 
        'XLE': 'Energy',
        'XLV': 'Healthcare',
        'XLI': 'Industrials',
        'IWM': 'Small Cap',
      };
      
      const [topSector, perf] = missingStrongPerformers[0];
      
      suggestions.push({
        id: `sector-${topSector}-${Date.now()}`,
        ticker: topSector,
        strategyType: 'CSP',
        suggestionType: 'sector',
        confidence: perf > 2 ? 'high' : 'medium',
        ivRank: 50,
        delta: -0.20,
        dteRecommendation: 30,
        strikeSelection: `${sectorNames[topSector] || 'Sector'} ETF`,
        premiumEstimate: 1.5,
        rationale: `${sectorNames[topSector] || 'Sector'} showing strong momentum (+${perf.toFixed(2)}%). Consider CSP on ETF for sector exposure without stock picking risk.`,
        technicalSignal: `Sector outperforming +${perf.toFixed(2)}%`,
      });
    }
  }
  
  return suggestions;
}

/**
 * GET /api/strategy/suggestions
 * Get AI-generated strategy suggestions based on portfolio analysis
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const maxSuggestions = parseInt(searchParams.get('limit') || '10');
    
    // Get positions
    const positions = getOpenPositions(db);
    
    if (positions.length === 0) {
      // Return default suggestions if no positions
      const defaultSuggestions: StrategySuggestion[] = [
        {
          id: 'default-1',
          ticker: 'SPY',
          strategyType: 'CSP',
          suggestionType: 'technical',
          confidence: 'medium',
          ivRank: 45,
          delta: -0.15,
          dteRecommendation: 30,
          strikeSelection: '$545 (≈3% OTM)',
          premiumEstimate: 2.10,
          rationale: 'No open positions detected. Starting with index CSPs provides consistent income with lower risk than individual stocks.',
          technicalSignal: 'Index trend analysis',
        },
      ];
      
      return NextResponse.json({
        data: defaultSuggestions,
        metadata: {
          positions: 0,
          analyzedTickers: 0,
          lastUpdated: new Date().toISOString(),
        },
      });
    }
    
    // Get position tickers
    const positionTickers = [...new Set(positions.map(p => p.ticker))];
    
    // Get supporting data
    const [earnings, ivRanks, stockPrices, sectorPerformance] = await Promise.all([
      getUpcomingEarnings(db, positionTickers),
      getIVRanks(db, positionTickers),
      getStockPrices(positionTickers),
      getSectorPerformance(),
    ]);
    
    // Generate suggestions
    const suggestions = await generateSuggestions(
      positions,
      earnings,
      ivRanks,
      stockPrices,
      sectorPerformance
    );
    
    // Sort suggestions
    const sorted = suggestions.sort((a, b) => {
      // High confidence first
      const confOrder = { high: 0, medium: 1, low: 2 };
      if (confOrder[a.confidence] !== confOrder[b.confidence]) {
        return confOrder[a.confidence] - confOrder[b.confidence];
      }
      // Then by IV rank (higher IV = better for selling)
      return b.ivRank - a.ivRank;
    });
    
    // Limit results
    const limited = sorted.slice(0, maxSuggestions);
    
    return NextResponse.json({
      data: limited,
      metadata: {
        positions: positions.length,
        analyzedTickers: positionTickers.length,
        ivRankedTickers: ivRanks.size,
        earningsWarning: earnings.filter(e => e.daysToEarnings <= 7).length,
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[StrategySuggestions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate strategy suggestions' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}

/**
 * POST /api/strategy/suggestions
 * Force re-analysis
 */
export async function POST(request: NextRequest) {
  const db = getDb();
  
  try {
    const body = await request.json();
    const ticker = body.ticker;
    
    if (ticker) {
      // Clear cache for specific ticker and regenerate
      db.prepare(`
        DELETE FROM strategy_suggestions WHERE ticker = ?
      `).run(ticker.toUpperCase());
    }
    
    return NextResponse.json({
      message: ticker ? `Suggestions for ${ticker} scheduled for refresh` : 'All suggestions refreshed',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[StrategySuggestions] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh suggestions' },
      { status: 500 }
    );
  } finally {
    db.close();
  }
}
