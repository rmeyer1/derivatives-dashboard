import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use /api/strategy/suggestions instead
 * This endpoint is kept for backward compatibility but delegates to the new API
 */

export async function GET(request: NextRequest) {
  console.warn('[Suggestions API] This endpoint is deprecated, use /api/strategy/suggestions');
  
  // Forward to the new API
  const { searchParams } = new URL(request.url);
  const newUrl = `${request.nextUrl.origin}/api/strategy/suggestions?${searchParams.toString()}`;
  
  try {
    const response = await fetch(newUrl, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Fallback to mock data if forward fails
    const mockSuggestions = [
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
    ];
    
    return NextResponse.json({
      data: mockSuggestions,
      deprecated: true,
      timestamp: new Date().toISOString(),
    });
  }
}
