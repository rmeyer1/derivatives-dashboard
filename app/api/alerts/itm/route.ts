import { NextResponse } from "next/server";
import { getITMAlerts } from "@/lib/db/positions";

// GET /api/alerts/itm - Get ITM alerts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const acknowledged = searchParams.get('acknowledged');
    const includeExpired = searchParams.get('includeExpired');
    
    const filters: { acknowledged?: boolean; includeExpired?: boolean } = {};
    
    if (acknowledged !== null) {
      filters.acknowledged = acknowledged === 'true';
    }
    
    if (includeExpired !== null) {
      filters.includeExpired = includeExpired === 'true';
    }
    
    const alerts = await getITMAlerts(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Error fetching ITM alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch ITM alerts", detail: String(error) },
      { status: 500 }
    );
  }
}
