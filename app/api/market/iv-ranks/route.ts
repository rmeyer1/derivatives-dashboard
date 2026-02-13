import { NextRequest, NextResponse } from 'next/server';

// Mock IV Rank data - in production, this would fetch from a data provider
const mockIVRanks = [
  { ticker: 'SPY', ivRank: 45, ivPercentile: 42, currentIV: 0.18, iv52WeekHigh: 0.35, iv52WeekLow: 0.12, impliedMove: 0.011, lastUpdated: new Date().toISOString() },
  { ticker: 'QQQ', ivRank: 52, ivPercentile: 55, currentIV: 0.22, iv52WeekHigh: 0.42, iv52WeekLow: 0.15, impliedMove: 0.014, lastUpdated: new Date().toISOString() },
  { ticker: 'IWM', ivRank: 38, ivPercentile: 35, currentIV: 0.19, iv52WeekHigh: 0.38, iv52WeekLow: 0.13, impliedMove: 0.012, lastUpdated: new Date().toISOString() },
  { ticker: 'AAPL', ivRank: 72, ivPercentile: 75, currentIV: 0.28, iv52WeekHigh: 0.45, iv52WeekLow: 0.16, impliedMove: 0.018, lastUpdated: new Date().toISOString() },
  { ticker: 'NVDA', ivRank: 88, ivPercentile: 90, currentIV: 0.42, iv52WeekHigh: 0.65, iv52WeekLow: 0.22, impliedMove: 0.026, lastUpdated: new Date().toISOString() },
  { ticker: 'TSLA', ivRank: 95, ivPercentile: 92, currentIV: 0.55, iv52WeekHigh: 0.78, iv52WeekLow: 0.28, impliedMove: 0.035, lastUpdated: new Date().toISOString() },
  { ticker: 'AMD', ivRank: 83, ivPercentile: 85, currentIV: 0.35, iv52WeekHigh: 0.52, iv52WeekLow: 0.18, impliedMove: 0.022, lastUpdated: new Date().toISOString() },
  { ticker: 'MSFT', ivRank: 35, ivPercentile: 30, currentIV: 0.16, iv52WeekHigh: 0.32, iv52WeekLow: 0.11, impliedMove: 0.010, lastUpdated: new Date().toISOString() },
  { ticker: 'GOOGL', ivRank: 42, ivPercentile: 40, currentIV: 0.20, iv52WeekHigh: 0.38, iv52WeekLow: 0.14, impliedMove: 0.013, lastUpdated: new Date().toISOString() },
  { ticker: 'AMZN', ivRank: 58, ivPercentile: 60, currentIV: 0.25, iv52WeekHigh: 0.42, iv52WeekLow: 0.15, impliedMove: 0.016, lastUpdated: new Date().toISOString() },
  { ticker: 'META', ivRank: 65, ivPercentile: 68, currentIV: 0.30, iv52WeekHigh: 0.48, iv52WeekLow: 0.17, impliedMove: 0.019, lastUpdated: new Date().toISOString() },
  { ticker: 'NFLX', ivRank: 78, ivPercentile: 80, currentIV: 0.38, iv52WeekHigh: 0.55, iv52WeekLow: 0.20, impliedMove: 0.024, lastUpdated: new Date().toISOString() },
  { ticker: 'CRM', ivRank: 55, ivPercentile: 52, currentIV: 0.24, iv52WeekHigh: 0.40, iv52WeekLow: 0.14, impliedMove: 0.015, lastUpdated: new Date().toISOString() },
  { ticker: 'PYPL', ivRank: 62, ivPercentile: 58, currentIV: 0.29, iv52WeekHigh: 0.45, iv52WeekLow: 0.16, impliedMove: 0.018, lastUpdated: new Date().toISOString() },
  { ticker: 'UBER', ivRank: 48, ivPercentile: 45, currentIV: 0.21, iv52WeekHigh: 0.38, iv52WeekLow: 0.13, impliedMove: 0.013, lastUpdated: new Date().toISOString() },
];

export async function GET(request: NextRequest) {
  try {
    // In production, fetch from your data provider (e.g., Polygon, Tradier, etc.)
    // const response = await fetch(`https://api.polygon.io/v1/...`);
    
    return NextResponse.json({
      data: mockIVRanks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching IV ranks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IV ranks' },
      { status: 500 }
    );
  }
}
