import { NextRequest, NextResponse } from 'next/server';

type StrategyType = "CSP" | "CCS" | "Cash-Secured Put" | "Call Credit Spread";
type SuggestionType = "high_iv" | "low_iv" | "neutral" | "earnings" | "technical";
type Confidence = "high" | "medium" | "low";

interface StrategySuggestion {
  id: string;
  ticker: string;
  strategyType: StrategyType;
  suggestionType: SuggestionType;
  confidence: Confidence;
  ivRank: number;
  delta: number;
  dteRecommendation: number;
  strikeSelection: string;
  premiumEstimate: number;
  rationale: string;
  technicalSignal?: string;
  supportLevel?: number;
  resistanceLevel?: number;
}

// Mock strategy suggestions based on IV and technicals
const mockSuggestions: StrategySuggestion[] = [
  {
    id: '1',
    ticker: 'NVDA',
    strategyType: 'CSP',
    suggestionType: 'high_iv',
    confidence: 'high',
    ivRank: 88,
    delta: -0.22,
    dteRecommendation: 30,
    strikeSelection: '$120 (≈15% OTM)',
    premiumEstimate: 2.85,
    rationale: 'High IV Rank (88) presents excellent premium collection opportunity. Strong support at $115 from recent consolidation.',
    technicalSignal: 'Holding support, RSI neutral',
    supportLevel: 115.00,
    resistanceLevel: 145.00,
  },
  {
    id: '2',
    ticker: 'TSLA',
    strategyType: 'CSP',
    suggestionType: 'high_iv',
    confidence: 'medium',
    ivRank: 95,
    delta: -0.25,
    dteRecommendation: 21,
    strikeSelection: '$280 (≈12% OTM)',
    premiumEstimate: 4.50,
    rationale: 'Extremely high IV (Rank 95) generates excellent premium. Be cautious of volatility spikes. Consider half position sizing.',
    technicalSignal: 'Volatile chop, wait for pullback',
    supportLevel: 275.00,
    resistanceLevel: 340.00,
  },
  {
    id: '3',
    ticker: 'MSFT',
    strategyType: 'CSP',
    suggestionType: 'low_iv',
    confidence: 'high',
    ivRank: 35,
    delta: -0.18,
    dteRecommendation: 14,
    strikeSelection: '$420 (≈10% OTM)',
    premiumEstimate: 1.25,
    rationale: 'Low IV environment favors directional plays. Strong uptrend with solid fundamentals. Cash-secured put for entry.',
    technicalSignal: 'Strong uptrend, above all MAs',
    supportLevel: 425.00,
    resistanceLevel: 460.00,
  },
  {
    id: '4',
    ticker: 'META',
    strategyType: 'CCS',
    suggestionType: 'earnings',
    confidence: 'medium',
    ivRank: 65,
    delta: 0.28,
    dteRecommendation: 21,
    strikeSelection: '$635/$650',
    premiumEstimate: 2.10,
    rationale: 'Earnings in 10 days with elevated IV. Call credit spread benefits from IV crush post-earnings.',
    technicalSignal: 'Near resistance, extended run',
    supportLevel: 580.00,
    resistanceLevel: 635.00,
  },
  {
    id: '5',
    ticker: 'AMD',
    strategyType: 'CSP',
    suggestionType: 'earnings',
    confidence: 'low',
    ivRank: 83,
    delta: -0.30,
    dteRecommendation: 7,
    strikeSelection: '$115 (≈10% OTM)',
    premiumEstimate: 1.95,
    rationale: 'Earnings tomorrow - high risk/reward. Only if willing to take assignment. High implied move expected.',
    technicalSignal: 'Pre-earnings consolidation',
    supportLevel: 110.00,
    resistanceLevel: 135.00,
  },
  {
    id: '6',
    ticker: 'AAPL',
    strategyType: 'CSP',
    suggestionType: 'earnings',
    confidence: 'medium',
    ivRank: 72,
    delta: -0.20,
    dteRecommendation: 30,
    strikeSelection: '$245 (≈8% OTM)',
    premiumEstimate: 1.85,
    rationale: 'Earnings play with good support level. AAPL IV elevated but not extreme. Good risk/reward for defined risk.',
    technicalSignal: 'Strong support at $240',
    supportLevel: 240.00,
    resistanceLevel: 265.00,
  },
  {
    id: '7',
    ticker: 'AMZN',
    strategyType: 'CSP',
    suggestionType: 'technical',
    confidence: 'medium',
    ivRank: 58,
    delta: -0.19,
    dteRecommendation: 45,
    strikeSelection: '$220 (≈7% OTM)',
    premiumEstimate: 2.35,
    rationale: 'Technical bounce from 50-day MA. IV moderate, good for longer dated CSP for entry.',
    technicalSignal: 'Bouncing off 50-DMA support',
    supportLevel: 218.00,
    resistanceLevel: 245.00,
  },
  {
    id: '8',
    ticker: 'NFLX',
    strategyType: 'CCS',
    suggestionType: 'technical',
    confidence: 'high',
    ivRank: 78,
    delta: 0.22,
    dteRecommendation: 21,
    strikeSelection: '$990/$1010',
    premiumEstimate: 4.20,
    rationale: 'Overbought on weekly chart. Good IV for credit spread. Resistance confluence at $1000 psychological level.',
    technicalSignal: 'Overbought, resistance at $1000',
    supportLevel: 920.00,
    resistanceLevel: 1000.00,
  },
];

export async function GET(request: NextRequest) {
  try {
    // In production, this would:
    // 1. Fetch user's watchlist
    // 2. Analyze IV ranks and technicals
    // 3. Generate personalized suggestions based on criteria
    // 4. Return ranked by confidence and IV opportunity
    
    // Sort by confidence then IV rank
    const sortedSuggestions = [...mockSuggestions].sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 };
      if (confOrder[a.confidence] !== confOrder[b.confidence]) {
        return confOrder[a.confidence] - confOrder[b.confidence];
      }
      return b.ivRank - a.ivRank;
    });
    
    return NextResponse.json({
      data: sortedSuggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategy suggestions' },
      { status: 500 }
    );
  }
}
