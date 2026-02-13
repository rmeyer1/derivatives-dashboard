import { NextRequest, NextResponse } from "next/server"
import { getPositions, createPosition } from "@/lib/db/positions"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const strategy = searchParams.get("strategy") || undefined
    const ticker = searchParams.get("ticker") || undefined
    
    const positions = await getPositions({ status, strategy, ticker })
    return NextResponse.json(positions)
  } catch (error) {
    console.error("Error fetching positions:", error)
    return NextResponse.json(
      { error: "Failed to fetch positions", detail: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const required = ['ticker', 'strategy', 'contracts', 'short_strike', 'entry_credit_per_contract', 'expiration_date']
    for (const field of required) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    
    const position = await createPosition(body)
    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    console.error("Error creating position:", error)
    return NextResponse.json(
      { error: "Failed to create position", detail: String(error) },
      { status: 500 }
    )
  }
}
