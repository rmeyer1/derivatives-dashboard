import { NextRequest, NextResponse } from "next/server"
import { subscriptionStore, StoredSubscription } from "@/lib/subscriptions"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscription }: { subscription: StoredSubscription } = body

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      )
    }

    // Store subscription
    subscriptionStore.add(subscription)

    // In development, log the subscription
    if (process.env.NODE_ENV === "development") {
      console.log("Push subscription registered:", {
        endpoint: subscription.endpoint.substring(0, 50) + "...",
        keys: subscription.keys ? "present" : "missing",
        count: subscriptionStore.size,
      })
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Subscription registered",
        endpoints: subscriptionStore.getEndpoints().map((e) => 
          e.substring(0, 30) + "..."
        ),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error registering subscription:", error)
    return NextResponse.json(
      { error: "Failed to register subscription" },
      { status: 500 }
    )
  }
}

// Allow getting current subscription count
export async function GET() {
  return NextResponse.json({
    count: subscriptionStore.size,
    endpoints: subscriptionStore.getEndpoints().map((e) => 
      e.substring(0, 30) + "..."
    ),
  })
}
