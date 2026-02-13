import { NextRequest, NextResponse } from "next/server"
import { subscriptionStore } from "@/lib/subscriptions"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint }: { endpoint: string } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing required field: endpoint" },
        { status: 400 }
      )
    }

    // Remove the subscription
    const deleted = subscriptionStore.remove(endpoint)

    if (!deleted) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Unsubscribed successfully",
        remaining: subscriptionStore.size
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error unsubscribing:", error)
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    )
  }
}
