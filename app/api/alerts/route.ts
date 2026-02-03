import { Alert } from "@/types/dashboard"

// Mock data for alerts
const mockAlerts: Alert[] = [
  {
    id: "1",
    title: "High IV Contraction",
    description: "AAPL implied volatility dropped 15% in the last hour",
    timestamp: "2026-02-03T12:34:00Z",
    priority: "high",
    read: false
  },
  {
    id: "2",
    title: "Near Expiration",
    description: "Position in AAPL $185 Call expires tomorrow",
    timestamp: "2026-02-03T11:22:00Z",
    priority: "medium",
    read: false
  },
  {
    id: "3",
    title: "Large Delta Exposure",
    description: "Net delta exposure exceeds threshold (-0.85)",
    timestamp: "2026-02-03T10:45:00Z",
    priority: "high",
    read: true
  },
  {
    id: "4",
    title: "Earnings Announcement",
    description: "MSFT earnings announced in 2 hours",
    timestamp: "2026-02-03T09:15:00Z",
    priority: "medium",
    read: true
  },
  {
    id: "5",
    title: "Unusual Volume",
    description: "TSLA options volume 3x above average",
    timestamp: "2026-02-03T08:30:00Z",
    priority: "low",
    read: true
  }
]

export async function GET() {
  return Response.json(mockAlerts)
}