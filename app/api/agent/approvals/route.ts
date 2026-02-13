import { NextResponse } from "next/server"
import type { TradeApproval } from "@/types/agent"

// Mock data store - in production this would be a database
let approvals: TradeApproval[] = [
  {
    id: "1",
    suggestion: {
      id: "s1",
      symbol: "AAPL",
      positionType: "long",
      tradeType: "call",
      suggestedSize: 5,
      strikePrice: 180,
      expiration: new Date(Date.now() + 7 * 86400000).toISOString(),
      reasoning: "AAPL showing bullish momentum with breakout above 180 resistance. Strong earnings expected next week. Technical indicators suggest continuation.",
      confidence: 82,
      riskLevel: "medium",
      suggestedAt: new Date(Date.now() - 3600000).toISOString()
    },
    status: "pending",
    executed: false
  },
  {
    id: "2",
    suggestion: {
      id: "s2",
      symbol: "NVDA",
      positionType: "short",
      tradeType: "put",
      suggestedSize: 3,
      strikePrice: 420,
      expiration: new Date(Date.now() + 14 * 86400000).toISOString(),
      reasoning: "NVDA overbought on daily RSI. Potential pullback expected before next earnings. Support at 410 level.",
      confidence: 68,
      riskLevel: "high",
      suggestedAt: new Date(Date.now() - 7200000).toISOString()
    },
    status: "pending",
    executed: false
  },
  {
    id: "3",
    suggestion: {
      id: "s3",
      symbol: "TSLA",
      positionType: "long",
      tradeType: "call",
      suggestedSize: 10,
      strikePrice: 175,
      expiration: new Date(Date.now() + 7 * 86400000).toISOString(),
      reasoning: "TSLA bounced off 200-day DMA. Bullish divergence on MACD. Targeting momentum continuation.",
      confidence: 75,
      riskLevel: "medium",
      suggestedAt: new Date(Date.now() - 86400000).toISOString()
    },
    status: "approved",
    approvedAt: new Date(Date.now() - 82800000).toISOString(),
    approvedBy: "user",
    notes: "Good setup, executing",
    executed: true
  },
  {
    id: "4",
    suggestion: {
      id: "s4",
      symbol: "MSFT",
      positionType: "long",
      tradeType: "call",
      suggestedSize: 4,
      strikePrice: 380,
      expiration: new Date(Date.now() + 21 * 86400000).toISOString(),
      reasoning: "MSFT in uptrend channel. Support held at 375. AI developments catalyst for upside.",
      confidence: 88,
      riskLevel: "low",
      suggestedAt: new Date(Date.now() - 172800000).toISOString()
    },
    status: "declined",
    approvedAt: new Date(Date.now() - 170000000).toISOString(),
    approvedBy: "user",
    notes: "Already have MSFT exposure",
    executed: false
  },
  {
    id: "5",
    suggestion: {
      id: "s5",
      symbol: "AMD",
      positionType: "long",
      tradeType: "call",
      suggestedSize: 8,
      entryPrice: 145.50,
      expiration: new Date(Date.now() + 7 * 86400000).toISOString(),
      reasoning: "AMD breaking out of consolidation. Volume spike confirms move. Technical target $155.",
      confidence: 71,
      riskLevel: "medium",
      suggestedAt: new Date(Date.now() - 1800000).toISOString()
    },
    status: "pending",
    executed: false
  }
]

// GET /api/agent/approvals - Fetch all trade approvals
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as TradeApproval['status'] | null
    
    let filtered = [...approvals]
    
    if (status) {
      filtered = filtered.filter(a => a.status === status)
    }
    
    // Sort by suggested time descending
    filtered.sort((a, b) => 
      new Date(b.suggestion.suggestedAt).getTime() - new Date(a.suggestion.suggestedAt).getTime()
    )
    
    const pending = filtered.filter(a => a.status === 'pending')
    const history = filtered.filter(a => a.status !== 'pending')
    
    return NextResponse.json({
      pending,
      history,
      pendingCount: pending.length
    })
  } catch (error) {
    console.error("Error fetching approvals:", error)
    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 }
    )
  }
}

// POST /api/agent/approvals - Create a new trade suggestion
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      symbol, 
      positionType, 
      tradeType, 
      suggestedSize,
      entryPrice,
      strikePrice,
      expiration,
      reasoning,
      confidence,
      riskLevel 
    } = body
    
    if (!symbol || !positionType || !tradeType || !suggestedSize || !reasoning) {
      return NextResponse.json(
        { error: "Required fields missing" },
        { status: 400 }
      )
    }
    
    const newApproval: TradeApproval = {
      id: Date.now().toString(),
      suggestion: {
        id: `s${Date.now()}`,
        symbol: symbol.toUpperCase(),
        positionType,
        tradeType,
        suggestedSize,
        entryPrice,
        strikePrice,
        expiration,
        reasoning,
        confidence: confidence || 70,
        riskLevel: riskLevel || 'medium',
        suggestedAt: new Date().toISOString()
      },
      status: "pending",
      executed: false
    }
    
    approvals.unshift(newApproval)
    
    return NextResponse.json(newApproval, { status: 201 })
  } catch (error) {
    console.error("Error creating approval:", error)
    return NextResponse.json(
      { error: "Failed to create approval" },
      { status: 500 }
    )
  }
}

// PUT /api/agent/approvals/:id - Update approval status
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, status, notes, approvedBy } = body
    
    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      )
    }
    
    const approvalIndex = approvals.findIndex(a => a.id === id)
    
    if (approvalIndex === -1) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      )
    }
    
    const updatedApproval = {
      ...approvals[approvalIndex],
      status,
      approvedAt: new Date().toISOString(),
      approvedBy: approvedBy || 'user',
      ...(notes && { notes })
    }
    
    approvals[approvalIndex] = updatedApproval
    
    return NextResponse.json(updatedApproval)
  } catch (error) {
    console.error("Error updating approval:", error)
    return NextResponse.json(
      { error: "Failed to update approval" },
      { status: 500 }
    )
  }
}
