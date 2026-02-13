import { NextRequest, NextResponse } from 'next/server';

// Mock earnings data - in production, this would fetch from a data provider
const mockEarnings = [
  { ticker: 'NVDA', earningsDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 5.02, consensusEPS: 4.98, hasPosition: true, daysToEarnings: 1, impliedMove: 0.08, lastYearSurprise: 0.12 },
  { ticker: 'AAPL', earningsDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 1.45, consensusEPS: 1.42, hasPosition: true, daysToEarnings: 3, impliedMove: 0.04, lastYearSurprise: 0.08 },
  { ticker: 'MSFT', earningsDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 2.78, consensusEPS: 2.71, hasPosition: false, daysToEarnings: 5, impliedMove: 0.035, lastYearSurprise: 0.05 },
  { ticker: 'TSLA', earningsDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 0.82, consensusEPS: 0.79, hasPosition: false, daysToEarnings: 7, impliedMove: 0.065, lastYearSurprise: -0.03 },
  { ticker: 'AMZN', earningsDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 1.15, consensusEPS: 1.12, hasPosition: true, daysToEarnings: 8, impliedMove: 0.05, lastYearSurprise: 0.15 },
  { ticker: 'META', earningsDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 5.25, consensusEPS: 5.15, hasPosition: false, daysToEarnings: 10, impliedMove: 0.055, lastYearSurprise: 0.18 },
  { ticker: 'GOOGL', earningsDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 1.85, consensusEPS: 1.82, hasPosition: false, daysToEarnings: 12, impliedMove: 0.04, lastYearSurprise: 0.06 },
  { ticker: 'NFLX', earningsDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 4.20, consensusEPS: 4.15, hasPosition: false, daysToEarnings: 15, impliedMove: 0.07, lastYearSurprise: 0.25 },
  { ticker: 'CRM', earningsDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 2.10, consensusEPS: 2.05, hasPosition: false, daysToEarnings: 18, impliedMove: 0.045, lastYearSurprise: 0.09 },
  { ticker: 'AMD', earningsDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 0.78, consensusEPS: 0.75, hasPosition: true, daysToEarnings: 2, impliedMove: 0.06, lastYearSurprise: 0.10 },
  { ticker: 'PYPL', earningsDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 1.12, consensusEPS: 1.09, hasPosition: false, daysToEarnings: 6, impliedMove: 0.055, lastYearSurprise: -0.02 },
  { ticker: 'UBER', earningsDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), earningsTime: 'after_close' as const, expectedEPS: 0.25, consensusEPS: 0.22, hasPosition: false, daysToEarnings: 20, impliedMove: 0.065, lastYearSurprise: 0.45 },
];

export async function GET(request: NextRequest) {
  try {
    // In production, fetch from your data provider
    // Filter for positions would be added here based on user's actual positions
    
    return NextResponse.json({
      data: mockEarnings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings data' },
      { status: 500 }
    );
  }
}
