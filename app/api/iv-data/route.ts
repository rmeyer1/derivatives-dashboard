import { NextResponse } from "next/server"

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000"

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/iv-data`, {
      cache: "no-store",
    })
    
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching IV data from backend:", error)
    return NextResponse.json(
      { error: "Failed to fetch IV data" },
      { status: 500 }
    )
  }
}
