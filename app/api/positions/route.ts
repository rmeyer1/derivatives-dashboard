import { PortfolioItem } from "@/types/dashboard"

// Mock data for portfolio positions
const mockPositions: PortfolioItem[] = [
  {
    id: "1",
    symbol: "AAPL",
    type: "Call",
    strike: 185,
    expiration: "2026-02-15",
    quantity: 10,
    avgPrice: 3.50,
    marketPrice: 4.25,
    pnl: 750,
    iv: 22.5,
    delta: 0.65,
    gamma: 0.03,
    theta: -0.05,
    vega: 0.12
  },
  {
    id: "2",
    symbol: "AAPL",
    type: "Put",
    strike: 175,
    expiration: "2026-02-15",
    quantity: 5,
    avgPrice: 1.25,
    marketPrice: 1.80,
    pnl: 275,
    iv: 25.8,
    delta: -0.42,
    gamma: 0.04,
    theta: -0.03,
    vega: 0.08
  },
  {
    id: "3",
    symbol: "TSLA",
    type: "Call",
    strike: 220,
    expiration: "2026-02-28",
    quantity: 15,
    avgPrice: 8.75,
    marketPrice: 7.90,
    pnl: -1275,
    iv: 35.2,
    delta: 0.58,
    gamma: 0.02,
    theta: -0.12,
    vega: 0.22
  },
  {
    id: "4",
    symbol: "MSFT",
    type: "Put",
    strike: 380,
    expiration: "2026-03-15",
    quantity: 8,
    avgPrice: 5.30,
    marketPrice: 5.75,
    pnl: 360,
    iv: 19.7,
    delta: -0.35,
    gamma: 0.02,
    theta: -0.04,
    vega: 0.15
  },
  {
    id: "5",
    symbol: "GOOGL",
    type: "Call",
    strike: 150,
    expiration: "2026-03-22",
    quantity: 12,
    avgPrice: 4.80,
    marketPrice: 5.25,
    pnl: 540,
    iv: 21.3,
    delta: 0.62,
    gamma: 0.03,
    theta: -0.06,
    vega: 0.18
  }
]

export async function GET() {
  return Response.json(mockPositions)
}