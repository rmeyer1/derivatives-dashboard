import { NextResponse } from "next/server";
import { getUniqueStrategies, getUniqueTickers } from "@/lib/db/trades";

// GET /api/trades/filters - Get unique strategies and tickers for filter dropdowns
export async function GET() {
  try {
    const [strategies, tickers] = await Promise.all([
      getUniqueStrategies(),
      getUniqueTickers(),
    ]);
    
    return NextResponse.json({ strategies, tickers });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json(
      { error: "Failed to fetch filter options", detail: String(error) },
      { status: 500 }
    );
  }
}
