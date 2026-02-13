import { NextResponse } from "next/server";
import { getITMAlerts } from "@/lib/db/positions";

// GET /api/alerts - Get general alerts (including ITM alerts)
export async function GET() {
  try {
    // For now, return ITM alerts as the main alerts
    const alerts = await getITMAlerts();
    
    // Transform to a generic alert format
    const formattedAlerts = alerts.map(alert => ({
      id: `itm-${alert.positionId}`,
      title: `${alert.ticker} ${alert.strategy} ITM Alert`,
      description: `Position is ${alert.itmPercent.toFixed(1)}% ITM with ${alert.dte} DTE`,
      timestamp: new Date().toISOString(),
      priority: alert.urgency === 'critical' ? 'high' : alert.urgency === 'warning' ? 'medium' : 'low',
      read: alert.acknowledgmentFlag,
      positionId: alert.positionId,
      itmPercent: alert.itmPercent,
      dte: alert.dte,
      ticker: alert.ticker,
      strategy: alert.strategy
    }));
    
    return NextResponse.json(formattedAlerts);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts", detail: String(error) },
      { status: 500 }
    );
  }
}
