import { NextResponse } from "next/server";
import { getStrategyPerformance } from "@/lib/db/trades";

// GET /api/trades/performance - Win rate, avg ROC by strategy
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const fromDate = searchParams.get('from') || undefined;
    const toDate = searchParams.get('to') || undefined;
    
    const performance = await getStrategyPerformance({
      fromDate,
      toDate,
    });
    
    return NextResponse.json(performance);
  } catch (error) {
    console.error("Error fetching strategy performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategy performance", detail: String(error) },
      { status: 500 }
    );
  }
}
