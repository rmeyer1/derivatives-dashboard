import { NextResponse } from "next/server"
import type { AgentActivity } from "@/types/agent"

// Mock data store - in production this would be a database
let activities: AgentActivity[] = [
  {
    id: "1",
    type: "research",
    description: "Completed analysis of AAPL earnings report",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: "completed",
    metadata: { ticker: "AAPL", confidence: 85 }
  },
  {
    id: "2",
    type: "alert",
    description: "TSLA crossed below 50-day DMA",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    status: "completed",
    metadata: { ticker: "TSLA", price: 185.42 }
  },
  {
    id: "3",
    type: "trade_suggestion",
    description: "Suggested NVDA straddle for earnings play",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    status: "pending",
    metadata: { ticker: "NVDA", confidence: 72 }
  },
  {
    id: "4",
    type: "analysis",
    description: "Market volatility analysis completed",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: "completed",
    metadata: { vix: 18.5 }
  },
  {
    id: "5",
    type: "system",
    description: "Daily risk check completed successfully",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    status: "completed",
  },
  {
    id: "6",
    type: "research",
    description: "Failed to fetch data for XYZ ticker",
    timestamp: new Date(Date.now() - 43200000).toISOString(),
    status: "failed",
    metadata: { ticker: "XYZ", error: "API timeout" }
  }
]

// GET /api/agent/actions - Fetch all agent activities
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const type = searchParams.get('type') as AgentActivity['type'] | null
    const status = searchParams.get('status') as AgentActivity['status'] | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    let filtered = [...activities]
    
    if (type) {
      filtered = filtered.filter(a => a.type === type)
    }
    
    if (status) {
      filtered = filtered.filter(a => a.status === status)
    }
    
    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit)
    
    return NextResponse.json({
      activities: paginated,
      total,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error("Error fetching agent activities:", error)
    return NextResponse.json(
      { error: "Failed to fetch agent activities" },
      { status: 500 }
    )
  }
}

// POST /api/agent/actions - Log a new activity
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, description, status, metadata } = body
    
    if (!type || !description) {
      return NextResponse.json(
        { error: "Type and description are required" },
        { status: 400 }
      )
    }
    
    const newActivity: AgentActivity = {
      id: Date.now().toString(),
      type,
      description,
      timestamp: new Date().toISOString(),
      status: status || 'pending',
      metadata
    }
    
    activities.unshift(newActivity)
    
    return NextResponse.json(newActivity, { status: 201 })
  } catch (error) {
    console.error("Error creating activity:", error)
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    )
  }
}
