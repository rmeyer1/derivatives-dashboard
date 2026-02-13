import { NextResponse } from "next/server";
import { getITMAlerts } from "@/lib/db/positions";

// GET /api/alerts/itm - Get ITM alerts
export async function GET() {
  try {
    const alerts = await getITMAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Error fetching ITM alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch ITM alerts", detail: String(error) },
      { status: 500 }
    );
  }
}
