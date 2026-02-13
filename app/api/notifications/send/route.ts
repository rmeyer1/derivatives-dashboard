import { NextRequest, NextResponse } from "next/server"
import { subscriptionStore } from "@/lib/subscriptions"

interface NotificationPayload {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const body: NotificationPayload = await request.json()
    const { userId, title, body: notificationBody, data } = body

    if (!title || !notificationBody) {
      return NextResponse.json(
        { error: "Missing required fields: title, body" },
        { status: 400 }
      )
    }

    // Get all subscriptions or filter by user
    let targetSubscriptions = subscriptionStore.getAll()
    
    if (userId && userId !== "all") {
      // In a real app, filter by userId
      targetSubscriptions = subscriptionStore.getAll()
    }

    if (targetSubscriptions.length === 0) {
      return NextResponse.json(
        { 
          error: "No subscriptions found",
          recipients: 0,
          sent: false,
        },
        { status: 404 }
      )
    }

    const results: Array<{ endpoint: string; success: boolean; error?: string }> = []

    // Send to all subscriptions
    // Note: In production, use a proper push service like web-push library
    for (const subscription of targetSubscriptions) {
      try {
        // For demo purposes, we'll just log and return success
        // In real implementation, you'd use web-push to send the message
        console.log("Would send push notification to:", {
          endpoint: subscription.endpoint.substring(0, 50) + "...",
          title,
          body: notificationBody.substring(0, 100),
        })

        results.push({
          endpoint: subscription.endpoint,
          success: true,
        })
      } catch (error) {
        results.push({
          endpoint: subscription.endpoint,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        recipients: targetSubscriptions.length,
        sent: true,
        results,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    )
  }
}

// Get notification status
export async function GET() {
  return NextResponse.json({
    subscriptions: subscriptionStore.size,
    ready: subscriptionStore.size > 0,
  })
}
