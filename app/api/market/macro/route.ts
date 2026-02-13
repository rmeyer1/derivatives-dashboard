import { NextRequest, NextResponse } from 'next/server';

// Generate realistic-looking sparkline data
const generateSparkline = (basePrice: number, volatility: number, points: number = 20) => {
  const sparkline = [];
  let currentPrice = basePrice;
  const now = Date.now();
  
  for (let i = points; i >= 0; i--) {
    const time = new Date(now - i * 60 * 60 * 1000); // Hourly data
    const change = (Math.random() - 0.5) * volatility * basePrice * 0.1;
    currentPrice += change;
    sparkline.push({
      time: time.toISOString(),
      value: currentPrice
    });
  }
  
  return sparkline;
};

// Mock macro market data
const mockMacroData = [
  {
    symbol: 'SPY',
    name: 'S&P 500 ETF',
    price: 595.32,
    change: 2.45,
    changePercent: 0.41,
    sparkline: generateSparkline(593, 0.15),
  },
  {
    symbol: 'QQQ',
    name: 'Nasdaq 100 ETF',
    price: 518.67,
    change: 3.89,
    changePercent: 0.76,
    sparkline: generateSparkline(515, 0.20),
  },
  {
    symbol: 'VIX',
    name: 'Volatility Index',
    price: 14.28,
    change: -0.85,
    changePercent: -5.62,
    sparkline: generateSparkline(15.1, 0.8),
  },
];

export async function GET(request: NextRequest) {
  try {
    // In production, fetch from your data provider
    // This would fetch real SPY/QQQ/VIX data with historical prices for sparklines
    
    return NextResponse.json({
      data: mockMacroData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching macro data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
