import { NextResponse } from "next/server";
import { getCompleteTradeHistory, getUniqueStrategies, getUniqueTickers } from "@/lib/db/trades";

// GET /api/trades/history - Fetch all trade events with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const fromDate = searchParams.get('from') || undefined;
    const toDate = searchParams.get('to') || undefined;
    const strategy = searchParams.get('strategy') || undefined;
    const ticker = searchParams.get('ticker') || undefined;
    
    const trades = await getCompleteTradeHistory({
      fromDate,
      toDate,
      strategy,
      ticker,
    });
    
    return NextResponse.json(trades);
  } catch (error) {
    console.error("Error fetching trade history:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade history", detail: String(error) },
      { status: 500 }
    );
  }
}
